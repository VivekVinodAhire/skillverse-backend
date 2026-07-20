const {
  pool,
} = require(
  "../config/db"
);

/*
  Create a new user
*/

const createUser = async ({
  fullName,
  email,
  password,
}) => {
  const normalizedFullName =
    String(fullName || "").trim();

  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  const [result] =
    await pool.execute(
      `
        INSERT INTO users (
          full_name,
          email,
          password
        )
        VALUES (?, ?, ?)
      `,
      [
        normalizedFullName,
        normalizedEmail,
        password,
      ]
    );

  return {
    id:
      result.insertId,

    fullName:
      normalizedFullName,

    full_name:
      normalizedFullName,

    email:
      normalizedEmail,
  };
};

/*
  Find user by email
*/

const findUserByEmail = async (
  email
) => {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    return null;
  }

  const [rows] =
    await pool.execute(
      `
        SELECT
          id,
          full_name,
          email,
          password,
          created_at
        FROM users
        WHERE LOWER(email) = ?
        LIMIT 1
      `,
      [
        normalizedEmail,
      ]
    );

  return rows[0] || null;
};

/*
  Find user by ID
*/

const findUserById = async (
  userId
) => {
  const validUserId =
    Number(userId);

  if (
    !Number.isInteger(
      validUserId
    ) ||
    validUserId <= 0
  ) {
    return null;
  }

  const [rows] =
    await pool.execute(
      `
        SELECT
          id,
          full_name,
          email,
          created_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [
        validUserId,
      ]
    );

  return rows[0] || null;
};

/*
  Check whether user ID exists
*/

const userExistsById = async (
  userId
) => {
  const validUserId =
    Number(userId);

  if (
    !Number.isInteger(
      validUserId
    ) ||
    validUserId <= 0
  ) {
    return false;
  }

  const [rows] =
    await pool.execute(
      `
        SELECT id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [
        validUserId,
      ]
    );

  return rows.length > 0;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  userExistsById,
};