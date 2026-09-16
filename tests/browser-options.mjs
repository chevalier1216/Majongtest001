// Optional runtime-provided Chromium; CI uses Playwright's pinned browser.
export const browserOptions=process.env.MAHJONG_CHROMIUM_PATH?{executablePath:process.env.MAHJONG_CHROMIUM_PATH,args:JSON.parse(process.env.MAHJONG_CHROMIUM_ARGS||'[]')}:{};
