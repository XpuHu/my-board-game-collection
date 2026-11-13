import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

export async function startLocalPostgres(dataDir = "memory://") {
  const db = await PGlite.create(dataDir);
  const server = new PGLiteSocketServer({
    db,
    host: "127.0.0.1",
    port: 0,
    maxConnections: 10,
  });
  try {
    await server.start();
    return {
      db,
      url: `postgresql://postgres@${server.getServerConn()}/postgres?sslmode=disable`,
      async close() {
        await server.stop();
        await db.close();
      },
    };
  } catch (error) {
    await db.close();
    throw error;
  }
}
