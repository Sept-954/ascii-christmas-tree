import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
const captureDir = join(root, "capture");
rmSync(captureDir, { recursive: true, force: true });
mkdirSync(captureDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath });
const context = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  recordVideo: {
    dir: captureDir,
    size: { width: 1080, height: 1920 },
  },
});
const page = await context.newPage();

page.on("pageerror", (error) => console.error(error));
await page.goto("http://127.0.0.1:4173/?record=1", { waitUntil: "networkidle" });
await page.waitForFunction(() => Boolean(window.christmasScene));
await page.waitForTimeout(20_500);
const video = page.video();
await context.close();
await browser.close();

const webm = await video.path();
const localFfmpeg = join(root, "vendor", "ffmpeg", "package", "ffmpeg.exe");
const ffmpeg = process.env.FFMPEG_PATH || (existsSync(localFfmpeg) ? localFfmpeg : "ffmpeg");
const output = join(root, "ascii-christmas-tree.mp4");
const args = [
  "-y",
  "-ss",
  "0.5",
  "-t",
  "20",
  "-i",
  webm,
  "-vf",
  "fps=30,scale=1080:1920:flags=lanczos",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-preset",
  "slow",
  "-crf",
  "18",
  "-movflags",
  "+faststart",
  "-an",
  output,
];

await new Promise((resolve, reject) => {
  const process = spawn(ffmpeg, args, { stdio: "inherit" });
  process.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`ffmpeg exited with ${code}`));
  });
});

console.log(output);
