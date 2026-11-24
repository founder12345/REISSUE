import { defineConfig } from '@playwright/test';
const baseURL='http://localhost:3210';
export default defineConfig({
  testDir:'tests/e2e', fullyParallel:false, workers:1, use:{
    baseURL,
    launchOptions:{executablePath:process.env.CHROMIUM_PATH||undefined},
  },
  webServer:{
    command:'npm run start -- --port 3210',
    url:baseURL,
    env:{APP_ORIGIN:baseURL},
    timeout:30000,
  },
});
