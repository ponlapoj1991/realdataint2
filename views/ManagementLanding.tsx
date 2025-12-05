import React from 'react';

const ManagementLanding: React.FC = () => {
  return (
    <div className="p-12 text-center text-gray-500 h-full flex items-center justify-center">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold text-gray-900">Management Data</h2>
        <p className="text-sm text-gray-500 max-w-2xl">
          Choose <strong>Ingestion Data</strong> or <strong>Preparation Data</strong> from the submenu to manage your tables. This space is reserved for future banners or onboarding tips.
        </p>
      </div>
    </div>
  );
};

export default ManagementLanding;
