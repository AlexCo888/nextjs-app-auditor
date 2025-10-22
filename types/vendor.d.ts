declare module 'tar-stream' {
  const tarStream: any;
  export default tarStream;
}

declare module 'micromatch' {
  const micromatch: any;
  export default micromatch;
  export function isMatch(path: string, pattern: string | string[]): boolean;
}

declare module 'istextorbinary' {
  export function isBinary(filename: string, buffer: Buffer): boolean;
}

declare module 'express' {
  const express: any;
  export default express;
}
