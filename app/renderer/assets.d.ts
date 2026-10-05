declare module "*.png" {
  const src: string;
  export default src;
}

// Side-effect stylesheet imports (main.tsx), bundled by Vite
declare module "*.css";
