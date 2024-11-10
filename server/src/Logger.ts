
// Logger class
export class Logger {
    constructor(private context: string) {}
  
    info(message: string, ...args: any[]) {
      console.log(`[${this.context}] [INFO] ${message}`, ...args);
    }
  
    warn(message: string, ...args: any[]) {
      console.warn(`[${this.context}] [WARN] ${message}`, ...args);
    }
  
    error(message: string, error?: any) {
      console.error(
        `[${this.context}] [ERROR] ${message}`,
        error instanceof Error ? {
          message: error.message,
          stack: error.stack,
          name: error.name
        } : error
      );
    }
  }