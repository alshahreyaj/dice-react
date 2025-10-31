# 🎲 Dice Masters - Board Game

A stylish dice game built with React, TypeScript, and Vite. Challenge the AI opponent in this classic dice game with a beautiful board game aesthetic!

## Features

- 🎨 **Stunning Board Game UI** - Wooden textures, felt green background, and gold accents
- 🤖 **Smart AI Opponent** - Adaptive AI that adjusts strategy based on game state
- 🎲 **Visual Dice** - Realistic 3D dice with dot patterns instead of numbers
- ✨ **Smooth Animations** - Polished transitions and effects
- 🎯 **Single Player** - You vs AI, first to 5000 points wins!

## How to Play

1. **Start the game** - Click "Start Game" to begin
2. **Roll dice** - Dice are rolled automatically at the start of your turn
3. **Select scoring dice** - Click on dice that form scoring combinations
4. **Bank or Pass**:
   - **Bank & Continue** - Save points and roll remaining dice
   - **Score & Pass** - End turn and add points to your total
5. **Win** - First player to reach 5000 points wins!

## Scoring Rules

- **Single 1** = 100 points
- **Single 5** = 50 points
- **Three of a kind**: Three 1s = 1000, others = face value × 100
- **Runs** (straights): 1-5 = 500, 2-6 = 750, 1-6 = 1500
- **Bust**: If no scoring dice, lose all turn points

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open your browser to the URL shown in the terminal (usually `http://localhost:5173`)

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS3** - Styling with gradients and animations

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
