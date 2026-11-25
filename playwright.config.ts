import { defineConfig } from '@playwright/test';
const baseURL='http://localhost:3210';
export default defineConfig({
  testDir:'tests/e2e', fullyParallel:false, workers:1, use:{
    baseURL,
    launchOptions:{executablePath:process.env.CHROMIUM_PATH||undefined},
  },
  webServer:[{command:'node tests/fixtures/mail-server.mjs',url:'http://127.0.0.1:3219',timeout:15000},{
    command:'npm run start -- --port 3210',
    url:baseURL,
    env:{APP_ORIGIN:baseURL,MAIL_TEST_ENDPOINT:'http://127.0.0.1:3219/emails',MAIL_API_KEY:'isolated-test',MAIL_FROM:'REISSUE <archive@example.test>',SEARCH_ANALYTICS:'true',TERMS_VERSION:'internal-draft-1'},
    timeout:30000,
  }],
});
