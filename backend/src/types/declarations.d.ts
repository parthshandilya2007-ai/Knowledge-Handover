declare module "mongodb-memory-server" {
  export class MongoMemoryServer {
    static create(opts?: any): Promise<MongoMemoryServer>;
    getUri(): string;
    stop(): Promise<boolean>;
  }
}

