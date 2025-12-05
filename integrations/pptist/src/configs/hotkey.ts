export const enum KEYS {
  C = 'C',
  X = 'X',
  Z = 'Z',
  Y = 'Y',
  A = 'A',
  G = 'G',
  L = 'L',
  F = 'F',
  D = 'D',
  B = 'B',
  P = 'P',
  O = 'O',
  R = 'R',
  T = 'T',
  MINUS = '-',
  EQUAL = '=',
  DIGIT_0 = '0',
  DELETE = 'DELETE',
  UP = 'ARROWUP',
  DOWN = 'ARROWDOWN',
  LEFT = 'ARROWLEFT',
  RIGHT = 'ARROWRIGHT',
  ENTER = 'ENTER',
  SPACE = ' ',
  TAB = 'TAB',
  BACKSPACE = 'BACKSPACE',
  ESC = 'ESCAPE',
  PAGEUP = 'PAGEUP',
  PAGEDOWN = 'PAGEDOWN',
  F5 = 'F5',
}

interface HotkeyItem {
  type: string
  children: {
    label: string
    value?: string
  }[]
}

export const HOTKEY_DOC: HotkeyItem[] = [
  {
    type: 'General',
    children: [
      { label: 'Cut', value: 'Ctrl + X' },
      { label: 'Copy', value: 'Ctrl + C' },
      { label: 'Paste', value: 'Ctrl + V' },
      { label: 'Paste as Plain Text', value: 'Ctrl + Shift + V' },
      { label: 'Quick Duplicate', value: 'Ctrl + D' },
      { label: 'Select All', value: 'Ctrl + A' },
      { label: 'Undo', value: 'Ctrl + Z' },
      { label: 'Redo', value: 'Ctrl + Y' },
      { label: 'Delete', value: 'Delete / Backspace' },
      { label: 'Multi-select', value: 'Hold Ctrl or Shift' },
      { label: 'Open Find & Replace', value: 'Ctrl + F' },
      { label: 'Print', value: 'Ctrl + P' },
      { label: 'Close Dialog', value: 'ESC' },
    ],
  },
  {
    type: 'Slideshow',
    children: [
      { label: 'Start from Beginning', value: 'F5' },
      { label: 'Start from Current Slide', value: 'Shift + F5' },
      { label: 'Previous Slide', value: 'Up / Left / PgUp' },
      { label: 'Next Slide', value: 'Down / Right / PgDown' },
      { label: 'Next Slide', value: 'Enter / Space' },
      { label: 'Exit Slideshow', value: 'ESC' },
    ],
  },
  {
    type: 'Slide Editing',
    children: [
      { label: 'New Slide', value: 'Enter' },
      { label: 'Pan Canvas', value: 'Space + Drag' },
      { label: 'Zoom Canvas', value: 'Ctrl + Scroll' },
      { label: 'Zoom In', value: 'Ctrl + =' },
      { label: 'Zoom Out', value: 'Ctrl + -' },
      { label: 'Fit to Screen', value: 'Ctrl + 0' },
      { label: 'Previous Slide (No Selection)', value: 'Up' },
      { label: 'Next Slide (No Selection)', value: 'Down' },
      { label: 'Previous Slide', value: 'Scroll Up / PgUp' },
      { label: 'Next Slide', value: 'Scroll Down / PgDown' },
      { label: 'Quick Create Text', value: 'Double-click / T' },
      { label: 'Quick Create Rectangle', value: 'R' },
      { label: 'Quick Create Circle', value: 'O' },
      { label: 'Quick Create Line', value: 'L' },
      { label: 'Exit Drawing Mode', value: 'Right-click' },
    ],
  },
  {
    type: 'Element Operations',
    children: [
      { label: 'Move', value: 'Up / Left / Down / Right' },
      { label: 'Lock', value: 'Ctrl + L' },
      { label: 'Group', value: 'Ctrl + G' },
      { label: 'Ungroup', value: 'Ctrl + Shift + G' },
      { label: 'Bring to Front', value: 'Alt + F' },
      { label: 'Send to Back', value: 'Alt + B' },
      { label: 'Lock Aspect Ratio', value: 'Hold Ctrl or Shift' },
      { label: 'Create H/V Line', value: 'Hold Ctrl or Shift' },
      { label: 'Switch Focus Element', value: 'Tab' },
      { label: 'Confirm Image Crop', value: 'Enter' },
      { label: 'Complete Custom Shape', value: 'Enter' },
    ],
  },
  {
    type: 'Table Editing',
    children: [
      { label: 'Focus Next Cell', value: 'Tab' },
      { label: 'Move Focus Cell', value: 'Up / Left / Down / Right' },
      { label: 'Insert Row Above', value: 'Ctrl + Up' },
      { label: 'Insert Row Below', value: 'Ctrl + Down' },
      { label: 'Insert Column Left', value: 'Ctrl + Left' },
      { label: 'Insert Column Right', value: 'Ctrl + Right' },
    ],
  },
  {
    type: 'Chart Data Editing',
    children: [
      { label: 'Focus Next Row', value: 'Enter' },
    ],
  },
  {
    type: 'Text Editing',
    children: [
      { label: 'Bold', value: 'Ctrl + B' },
      { label: 'Italic', value: 'Ctrl + I' },
      { label: 'Underline', value: 'Ctrl + U' },
      { label: 'Inline Code', value: 'Ctrl + E' },
      { label: 'Superscript', value: 'Ctrl + ;' },
      { label: 'Subscript', value: `Ctrl + '` },
      { label: 'Select Paragraph', value: `ESC` },
    ],
  },
  {
    type: 'Other Quick Operations',
    children: [
      { label: 'Add Image - Paste from clipboard' },
      { label: 'Add Image - Drag local image to canvas' },
      { label: 'Add Image - Paste SVG code to canvas' },
      { label: 'Add Image - Paste Pexels image link' },
      { label: 'Add Text - Paste text from clipboard' },
      { label: 'Add Text - Drag selected text to canvas' },
      { label: 'Text Editing - Markdown syntax for lists and quotes' },
    ],
  },
]
