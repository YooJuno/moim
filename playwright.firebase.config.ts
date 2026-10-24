import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests',testMatch:'firebase.integration.ts',fullyParallel:false,workers:1,timeout:60000,expect:{timeout:12000},
  use:{baseURL:'http://127.0.0.1:5174',channel:'chrome',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure'},
  reporter:'list',outputDir:'test-results/firebase',
  webServer:{command:'npm run dev -- --mode emulator --host 127.0.0.1 --port 5174 --strictPort',url:'http://127.0.0.1:5174',reuseExistingServer:false,timeout:30000},
});
