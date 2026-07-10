import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
    {
        ignores: [
            "dist",
            "node_modules",
            "../practice-host/**",
            "**/target/**",
            "coverage/**",
        ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.{ts,tsx}", "../../packages/**/src/**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            // Standard fetch-on-mount + async .then(setX) patterns; re-enable when refactored
            "react-hooks/set-state-in-effect": "off",
            "react-refresh/only-export-components": [
                "warn",
                { allowConstantExport: true },
            ],
        },
    },
    {
        files: [
            "src/views/**/*.{ts,tsx}",
            "../../packages/app/**/src/pages/**/*.{ts,tsx}",
        ],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["@tauri-apps/*"],
                            message:
                                "Views/pages must not import Tauri directly — use controllers or src/platform/* wrappers.",
                        },
                        {
                            group: ["**/systems/registry", "**/systems/shared/transport/*"],
                            message:
                                "Views/pages must not call practiceSystem/transport directly — use controllers under systems/*/controllers.",
                        },
                    ],
                },
            ],
        },
    },
);
