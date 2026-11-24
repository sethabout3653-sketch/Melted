export interface GameControlMapping {
  gameName: string;
  category: string;
  keybinds: {
    move?: string;
    action?: string;
    jump?: string;
    slide?: string;
    restart?: string;
    special?: string;
    description: string;
  };
  layout: 'dpad_action' | 'steering' | 'pointer_click' | 'platformer' | 'flappy' | 'arcade' | 'rpg' | 'fnf' | 'fnaf';
  buttons: Array<{
    id: string;
    label: string;
    key: string;
    code: string;
    icon?: string;
    color?: string;
  }>;
}

const DEFAULT_CONTROLS: GameControlMapping = {
  gameName: 'Default',
  category: 'Arcade',
  keybinds: {
    move: 'Arrow Keys / WASD',
    action: 'Space / Enter',
    jump: 'Up Arrow / Space',
    restart: 'R',
    description: 'Use D-Pad to move, A/B for action and jump.',
  },
  layout: 'dpad_action',
  buttons: [
    { id: 'up', label: '▲', key: 'ArrowUp', code: 'ArrowUp', color: 'blue' },
    { id: 'down', label: '▼', key: 'ArrowDown', code: 'ArrowDown', color: 'blue' },
    { id: 'left', label: '◄', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
    { id: 'right', label: '►', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
    { id: 'action', label: 'A', key: ' ', code: 'Space', color: 'green' },
    { id: 'jump', label: 'B', key: 'ArrowUp', code: 'ArrowUp', color: 'red' },
    { id: 'restart', label: '⟳', key: 'r', code: 'KeyR', color: 'slate' },
  ],
};

const SPECIFIC_GAME_CONTROLS: Record<string, GameControlMapping> = {
  'undertale': {
    gameName: 'Undertale',
    category: 'Horror & Mystery',
    keybinds: {
      move: 'Arrow Keys (Move Soul / Menu)',
      action: 'Z / Enter (Confirm / Attack)',
      special: 'X / Shift (Cancel / Run)',
      restart: 'C / Ctrl (Menu) & F4 (Fullscreen)',
      description: 'Exact Undertale controls: Arrow keys to dodge and navigate, Z to confirm/attack, X to cancel, C for menu.',
    },
    layout: 'rpg',
    buttons: [
      { id: 'up', label: '▲', key: 'ArrowUp', code: 'ArrowUp', color: 'blue' },
      { id: 'down', label: '▼', key: 'ArrowDown', code: 'ArrowDown', color: 'blue' },
      { id: 'left', label: '◄', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'right', label: '►', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
      { id: 'z_confirm', label: 'Z (Confirm)', key: 'z', code: 'KeyZ', color: 'green' },
      { id: 'x_cancel', label: 'X (Cancel)', key: 'x', code: 'KeyX', color: 'amber' },
      { id: 'c_menu', label: 'C (Menu)', key: 'c', code: 'KeyC', color: 'red' },
    ],
  },
  'bad time simulator (sans fight)': {
    gameName: 'Bad Time Simulator (Sans Fight)',
    category: 'Action & Shooters',
    keybinds: {
      move: 'Arrow Keys (Move Soul)',
      action: 'Z / Enter (Confirm / Heal)',
      special: 'X / Shift (Focus / Slow Soul)',
      restart: 'R (Restart Fight)',
      description: 'Exact Sans Fight controls: Arrow keys to dodge Gaster Blasters and bones, X to focus.',
    },
    layout: 'rpg',
    buttons: [
      { id: 'up', label: '▲', key: 'ArrowUp', code: 'ArrowUp', color: 'blue' },
      { id: 'down', label: '▼', key: 'ArrowDown', code: 'ArrowDown', color: 'blue' },
      { id: 'left', label: '◄', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'right', label: '►', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
      { id: 'z_action', label: 'Z (Confirm)', key: 'z', code: 'KeyZ', color: 'green' },
      { id: 'x_focus', label: 'X (Focus)', key: 'x', code: 'KeyX', color: 'amber' },
    ],
  },
  'deltarune': {
    gameName: 'Deltarune',
    category: 'Retro & Arcade',
    keybinds: {
      move: 'Arrow Keys',
      action: 'Z / Enter (Confirm / Act / Fight)',
      special: 'X / Shift (Cancel / Spell menu)',
      restart: 'C / Ctrl (Item menu)',
      description: 'Exact Deltarune controls: Arrow keys, Z to confirm/action, X to cancel.',
    },
    layout: 'rpg',
    buttons: [
      { id: 'up', label: '▲', key: 'ArrowUp', code: 'ArrowUp', color: 'blue' },
      { id: 'down', label: '▼', key: 'ArrowDown', code: 'ArrowDown', color: 'blue' },
      { id: 'left', label: '◄', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'right', label: '►', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
      { id: 'z_act', label: 'Z (Act)', key: 'z', code: 'KeyZ', color: 'green' },
      { id: 'x_cancel', label: 'X (Cancel)', key: 'x', code: 'KeyX', color: 'amber' },
      { id: 'c_item', label: 'C (Item)', key: 'c', code: 'KeyC', color: 'red' },
    ],
  },
  'friday night funkin': {
    gameName: 'Friday Night Funkin',
    category: 'Retro & Arcade',
    keybinds: {
      move: 'A, S, W, D or Left, Down, Up, Right Arrow Keys',
      action: 'Enter to Select / Pause',
      description: 'Rhythm matching: Hit Left (A/◄), Down (S/▼), Up (W/▲), Right (D/►) to the beat.',
    },
    layout: 'fnf',
    buttons: [
      { id: 'fnf_left', label: '◄ LEFT', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'fnf_down', label: '▼ DOWN', key: 'ArrowDown', code: 'ArrowDown', color: 'green' },
      { id: 'fnf_up', label: '▲ UP', key: 'ArrowUp', code: 'ArrowUp', color: 'amber' },
      { id: 'fnf_right', label: '► RIGHT', key: 'ArrowRight', code: 'ArrowRight', color: 'red' },
    ],
  },
  'five nights at freddys': {
    gameName: "Five Nights at Freddy's",
    category: 'Horror & Mystery',
    keybinds: {
      move: 'Mouse to look around / Click monitor and buttons',
      action: 'Ctrl / F for Flashlight, A for Left Light, D for Right Light',
      special: 'Space to toggle Camera Monitor',
      description: 'Survive the night by monitoring security cameras and managing power & doors.',
    },
    layout: 'fnaf',
    buttons: [
      { id: 'cam', label: '📺 CAMERAS', key: ' ', code: 'Space', color: 'blue' },
      { id: 'light_left', label: '💡 L-LIGHT', key: 'a', code: 'KeyA', color: 'amber' },
      { id: 'light_right', label: '💡 R-LIGHT', key: 'd', code: 'KeyD', color: 'amber' },
      { id: 'door_left', label: '🚪 L-DOOR', key: 'q', code: 'KeyQ', color: 'red' },
      { id: 'door_right', label: '🚪 R-DOOR', key: 'e', code: 'KeyE', color: 'red' },
    ],
  },
  'drive mad': {
    gameName: 'Drive Mad',
    category: 'Driving & Racing',
    keybinds: {
      move: 'Arrow Keys / W & S / A & D',
      action: 'Space / Accelerate & Reverse',
      restart: 'R to Restart Level',
      description: 'Control truck balance and speed with Arrow Keys or W/S.',
    },
    layout: 'steering',
    buttons: [
      { id: 'forward', label: 'ACCEL', key: 'ArrowUp', code: 'ArrowUp', color: 'green' },
      { id: 'reverse', label: 'REV', key: 'ArrowDown', code: 'ArrowDown', color: 'amber' },
      { id: 'tilt_left', label: '◄ TILT', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'tilt_right', label: 'TILT ►', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
      { id: 'restart', label: 'RESTART (R)', key: 'r', code: 'KeyR', color: 'red' },
    ],
  },
  'ovo': {
    gameName: 'OvO',
    category: 'Skill & Platformer',
    keybinds: {
      move: 'Left / Right Arrow Keys',
      jump: 'Up Arrow or Space',
      slide: 'Down Arrow (Slide / Dive)',
      restart: 'R',
      description: 'Run, jump, slide and wall-climb through obstacle courses.',
    },
    layout: 'platformer',
    buttons: [
      { id: 'left', label: '◄', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'right', label: '►', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
      { id: 'jump', label: 'JUMP', key: 'ArrowUp', code: 'ArrowUp', color: 'green' },
      { id: 'slide', label: 'SLIDE', key: 'ArrowDown', code: 'ArrowDown', color: 'amber' },
      { id: 'restart', label: '⟳', key: 'r', code: 'KeyR', color: 'red' },
    ],
  },
  'slope': {
    gameName: 'Slope',
    category: 'Skill & Platformer',
    keybinds: {
      move: 'A & D or Left & Right Arrow Keys',
      description: 'Steer the ball carefully down the neon 3D slope.',
    },
    layout: 'steering',
    buttons: [
      { id: 'left', label: '◄ STEER LEFT', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'right', label: 'STEER RIGHT ►', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
    ],
  },
  'retro bowl': {
    gameName: 'Retro Bowl',
    category: 'Sports & Physics',
    keybinds: {
      move: 'Swipe / Mouse Drag or Arrow Keys',
      action: 'Tap / Click to Throw / Snap',
      description: 'Manage your team and control passes with touch drag or mouse.',
    },
    layout: 'pointer_click',
    buttons: [
      { id: 'action', label: 'THROW / PASS', key: ' ', code: 'Space', color: 'green' },
      { id: 'select', label: 'SELECT', key: 'Enter', code: 'Enter', color: 'blue' },
    ],
  },
  'moto x3m': {
    gameName: 'Moto X3M',
    category: 'Driving & Racing',
    keybinds: {
      move: 'Up/Down (Gas/Brake), Left/Right (Flip/Balance)',
      restart: 'Space to Restart',
      description: 'Perform stunts and balance your motorcycle across stunt tracks.',
    },
    layout: 'steering',
    buttons: [
      { id: 'gas', label: 'GAS ⬆', key: 'ArrowUp', code: 'ArrowUp', color: 'green' },
      { id: 'brake', label: 'BRAKE ⬇', key: 'ArrowDown', code: 'ArrowDown', color: 'red' },
      { id: 'flip_left', label: '↶ FLIP', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'flip_right', label: 'FLIP ↷', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
    ],
  },
  'geometry dash': {
    gameName: 'Geometry Dash',
    category: 'Skill & Platformer',
    keybinds: {
      jump: 'Space / Up Arrow / Click / Tap',
      description: 'Tap or press Space to jump and fly over obstacles in rhythm.',
    },
    layout: 'arcade',
    buttons: [
      { id: 'jump', label: 'JUMP / TAP', key: ' ', code: 'Space', color: 'green' },
      { id: 'restart', label: '⟳', key: 'r', code: 'KeyR', color: 'slate' },
    ],
  },
  'cookie clicker': {
    gameName: 'Cookie Clicker',
    category: 'Puzzle & Casual',
    keybinds: {
      action: 'Tap / Click big cookie',
      description: 'Tap rapidly to bake cookies and buy grandmas & factories.',
    },
    layout: 'pointer_click',
    buttons: [
      { id: 'click', label: 'CLICK COOKIE! 🍪', key: ' ', code: 'Space', color: 'amber' },
    ],
  },
  'subway surfers': {
    gameName: 'Subway Surfers',
    category: 'Skill & Platformer',
    keybinds: {
      move: 'Arrow Keys (Left, Right, Up to Jump, Down to Roll)',
      description: 'Swipe or use arrow keys to dodge trains and barriers.',
    },
    layout: 'dpad_action',
    buttons: [
      { id: 'up', label: 'JUMP ⬆', key: 'ArrowUp', code: 'ArrowUp', color: 'green' },
      { id: 'down', label: 'ROLL ⬇', key: 'ArrowDown', code: 'ArrowDown', color: 'amber' },
      { id: 'left', label: '◄ LEFT', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'right', label: 'RIGHT ►', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
    ],
  },
  'vex 7': {
    gameName: 'Vex 7',
    category: 'Skill & Platformer',
    keybinds: {
      move: 'A & D or Left/Right Arrow',
      jump: 'W or Up Arrow',
      slide: 'S or Down Arrow',
      description: 'Run, jump and swing through deadly spike traps.',
    },
    layout: 'platformer',
    buttons: [
      { id: 'left', label: '◄', key: 'ArrowLeft', code: 'ArrowLeft', color: 'blue' },
      { id: 'right', label: '►', key: 'ArrowRight', code: 'ArrowRight', color: 'blue' },
      { id: 'jump', label: 'JUMP', key: 'ArrowUp', code: 'ArrowUp', color: 'green' },
      { id: 'slide', label: 'SLIDE', key: 'ArrowDown', code: 'ArrowDown', color: 'amber' },
    ],
  },
};

export function getGameControls(gameName?: string): GameControlMapping {
  if (!gameName) return DEFAULT_CONTROLS;
  const clean = gameName.toLowerCase().trim();
  if (SPECIFIC_GAME_CONTROLS[clean]) {
    return SPECIFIC_GAME_CONTROLS[clean];
  }
  // Partial matches
  for (const [key, mapping] of Object.entries(SPECIFIC_GAME_CONTROLS)) {
    if (clean.includes(key) || key.includes(clean)) {
      return mapping;
    }
  }
  return DEFAULT_CONTROLS;
}
