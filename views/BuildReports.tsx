import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import type { Project } from '../types';

interface BuildReportsProps {
  project: Project;
  onMessage?: (event: MessageEvent) => void;
  onIframeLoad?: (iframe: HTMLIFrameElement | null) => void;
}

const BUILD_REPORTS_ENTRY = '/build-reports/index.html';

const BuildReports: React.FC<BuildReportsProps> = ({ project, onMessage, onIframeLoad }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [handshakeMessage, setHandshakeMessage] = useState<string>('Waiting for editor to respond...');

  useEffect(() => {
    return () => {
      onIframeLoad?.(null);
    };
  }, [onIframeLoad]);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    fetch(BUILD_REPORTS_ENTRY, { method: 'HEAD', signal: controller.signal })
      .then((res) => {
        if (aborted) return;
        setIsAvailable(res.ok);
      })
      .catch(() => {
        if (aborted) return;
        setIsAvailable(false);
      });

    return () => {
      aborted = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'object' || !event.data) return;
      if (event.data?.source !== 'pptist') return;
      if (event.data?.type === 'ready') {
        setHandshakeMessage('Connected. PPTist editor ready.');
      }
      onMessage?.(event);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onMessage]);

  useEffect(() => {
    if (!isLoaded) return;
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;

    const payload = {
      source: 'realdata-host',
      type: 'project-context',
      project: {
        id: project.id,
        name: project.name,
        description: project.description ?? '',
      },
    };

    iframe.contentWindow.postMessage(payload, '*');
  }, [isLoaded, project]);

  const statusMessage = useMemo(() => {
    if (isAvailable === false) {
      return 'PPTist assets are missing. Build them first.';
    }
    if (isLoaded) return handshakeMessage;
    if (isAvailable) return 'Loading PPTist editor...';
    return 'Checking editor assets...';
  }, [handshakeMessage, isAvailable, isLoaded]);

  const handleReload = () => {
    setIsLoaded(false);
    setHandshakeMessage('Waiting for editor to respond...');
    iframeRef.current?.contentWindow?.location.reload();
  };

  return (
    <div className="w-full h-full bg-[#0f1115] relative flex flex-col">
      {isAvailable === false && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 text-gray-200 space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-400" />
          <div>
            <p className="font-semibold text-lg mb-1">PPTist assets not found</p>
            <p className="text-sm text-gray-400">
              Run <code className="px-2 py-1 bg-black/40 rounded">npm run build:pptist</code> to bundle the editor before opening Build Reports.
            </p>
          </div>
        </div>
      )}

      {isAvailable !== false && (
        <div className="flex-1 relative">
          {!isLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 space-y-3 z-10 bg-[#0f1115]">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">{statusMessage}</span>
            </div>
          )}

          <iframe
            ref={iframeRef}
            title="Build Reports"
            src={BUILD_REPORTS_ENTRY}
            className="w-full h-full border-0 bg-white"
            onLoad={() => {
              setIsLoaded(true);
              onIframeLoad?.(iframeRef.current);
            }}
          />
        </div>
      )}
    </div>
  );
};

export default BuildReports;
