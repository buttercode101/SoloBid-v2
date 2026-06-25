import 'http';

declare module 'http' {
  interface IncomingMessage {
    /** Express attaches the original request URL before body-parser verify hooks run. */
    originalUrl?: string;
  }
}
