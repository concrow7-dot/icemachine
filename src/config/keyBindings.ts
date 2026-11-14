// SCREAM-206 (decision 104): every key a player can press, in one place. The Key Bindings page
// on the pause menu (KeyBindingsScene) and the "How To Drive" pop-up (SCREAM-207) both read it,
// so a key is written down once. Built from the scenes' key handlers: when a scene gains or
// loses a key, change its row here too (tests/e2e/pause_test.cjs checks the groups exist).
// Debug keys (Shift + a number) are left out on purpose. Text follows doc 15's style
// (Title Case, "Or" between two keys).

/** One row: the key (or keys), then what it does. */
export type KeyRow = readonly [keys: string, does: string];

export interface KeyGroup {
  /** The group's name: the screen the keys work on. */
  title: string;
  rows: readonly KeyRow[];
}

export const DRIVING_KEYS: KeyGroup = {
  title: 'Driving',
  rows: [
    ['↑ Or W', 'Gas'],
    ['↓ Or S', 'Brake, Then Reverse'],
    ['← → Or A D', 'Steer'],
    ['Q', 'Park Brake (When Stopped)'],
    ['M', 'Music On Or Off'],
    ['N', 'Next Song'],
    ['Esc', 'Pause'],
  ],
};

export const KEY_GROUPS: readonly KeyGroup[] = [
  DRIVING_KEYS,
  {
    title: 'In The Truck',
    rows: [
      ['← → Or A D', 'Move Between The Parts'],
      ['Enter Or Space', 'Open The Part'],
      ['X', 'Skip The Uncle'],
      ['M', 'Music On Or Off'],
      ['N', 'Next Song'],
      ['Esc', 'Pause'],
    ],
  },
  {
    title: 'The Cooler',
    rows: [
      ['↑ ↓', 'Move Up And Down'],
      ['← →', 'Between The Clipboard And The Menu'],
      ['Enter Or Space', 'Buy'],
      ['+ And -', 'Add Or Take Off One (Or Change A Price)'],
      ['1 2 3', 'Choose A Crate'],
      ['B Or Backspace', 'Back To The Truck'],
      ['Esc', 'Pause'],
    ],
  },
  {
    title: 'The Sales Window',
    rows: [
      ['R', 'Ask Again'],
      ['Enter Or C', 'To The Cooler'],
      ['0-9 And .', 'Type The Price'],
      ['Backspace', 'Erase One Digit'],
      ['Delete', 'Clear The Price'],
      ['Enter', 'Charge'],
      ['Enter Or Space', 'Next Customer (When The Sale Is Over)'],
      ['B', 'Drive Off'],
      ['Esc', 'Pause'],
    ],
  },
  {
    title: 'Filling An Order',
    rows: [
      ['1 2 3', 'Open A Crate'],
      ['Arrows', 'Move Around The Crate'],
      ['+', 'Take One'],
      ['-', 'Put One Back'],
      ['Enter Or Space', 'Serve'],
      ['B Or Backspace', 'Forgot The Order'],
      ['Esc', 'Pause'],
    ],
  },
  {
    title: 'The Gas Pump',
    rows: [
      ['↑ → Or +', 'More Gas'],
      ['↓ ← Or -', 'Less Gas'],
      ['Enter', 'Pay'],
      ['B', 'Leave'],
      ['Esc', 'Pause'],
    ],
  },
  {
    title: 'The Cork Board',
    rows: [
      ['Arrows Or W A S D', 'Move Between Notes'],
      ['Enter Or Space', 'Open A Note, Then Buy'],
      ['B Or Backspace', 'Back'],
      ['Esc', 'Pause'],
    ],
  },
  {
    title: 'The End Of The Day',
    rows: [['Enter Or Click', 'Start The Next Day']],
  },
  {
    title: 'The Title Screen',
    rows: [
      ['↑ ↓', 'Choose'],
      ['Enter', 'Select'],
      ['← →', 'Choose An Answer'],
      ['Y Or N', 'Yes Or No'],
    ],
  },
  {
    title: 'The Uncle',
    rows: [
      ['Enter Or Space', 'Next Line'],
      ['X', 'Skip The Uncle'],
    ],
  },
  {
    title: 'The Pause Menu',
    rows: [
      ['↑ ↓ Or W S', 'Choose'],
      ['Enter', 'Select'],
      ['← →', 'Choose Yes Or No'],
      ['Y Or N', 'Yes Or No'],
      ['Esc', 'Resume'],
    ],
  },
  {
    title: 'The High Scores',
    rows: [
      ['↑ ↓', 'Change A Letter'],
      ['← →', 'Move To Another Letter'],
      ['Enter', 'Save, Then Play Again'],
      ['Esc', 'Pause (Or Back To The Title)'],
    ],
  },
];
