const mysql = require(
  "mysql2/promise"
);

const pool =
  mysql.createPool({
    host:
      process.env.DB_HOST,

    port:
      Number(
        process.env.DB_PORT ||
          3306
      ),

    user:
      process.env.DB_USER,

    password:
      process.env.DB_PASSWORD,

    database:
      process.env.DB_NAME,

    waitForConnections: true,

    connectionLimit: 10,

    queueLimit: 0,

    charset: "utf8mb4",
  });


const connectDatabase =
  async () => {
    let connection;

    try {
      connection =
        await pool.getConnection();

      const [rows] =
        await connection.query(
          `
            SELECT
              DATABASE() AS databaseName
          `
        );

      console.log(
        "✅ MySQL Connected Successfully"
      );

      console.log(
        "📦 Connected Database:",
        rows[0].databaseName
      );
    } catch (error) {
      console.error(
        "❌ MySQL Connection Failed:",
        error.message
      );

      process.exit(1);
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };


module.exports = {
  pool,
  connectDatabase,
};