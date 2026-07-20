const bcrypt = require(
  "bcryptjs"
);

const jwt = require(
  "jsonwebtoken"
);

const {
  createUser,
  findUserByEmail,
} = require(
  "../models/userModel"
);

const normalizeEmail = (
  value
) =>
  String(value || "")
    .trim()
    .toLowerCase();

const createAuthToken = (
  user
) => {
  if (
    !process.env.JWT_SECRET
  ) {
    throw new Error(
      "JWT_SECRET is missing in the environment variables"
    );
  }

  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

/*
  Register user

  POST /api/auth/register
*/

const registerUser = async (
  req,
  res
) => {
  try {
    const {
      fullName,
      full_name,
      name,
      email,
      password,
    } = req.body;

    const userFullName =
      fullName ||
      full_name ||
      name;

    const normalizedFullName =
      String(
        userFullName || ""
      ).trim();

    const normalizedEmail =
      normalizeEmail(email);

    const normalizedPassword =
      String(password || "");

    if (
      !normalizedFullName ||
      !normalizedEmail ||
      !normalizedPassword
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Full name, email and password are required",
        });
    }

    if (
      normalizedFullName.length <
      2
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Please enter a valid full name",
        });
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(
        normalizedEmail
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Please enter a valid email address",
        });
    }

    if (
      normalizedPassword.length <
      6
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Password must be at least 6 characters",
        });
    }

    const existingUser =
      await findUserByEmail(
        normalizedEmail
      );

    if (existingUser) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "An account with this email already exists",
        });
    }

    const hashedPassword =
      await bcrypt.hash(
        normalizedPassword,
        12
      );

    const createdUser =
      await createUser({
        fullName:
          normalizedFullName,

        email:
          normalizedEmail,

        password:
          hashedPassword,
      });

    const token =
      createAuthToken(
        createdUser
      );

    return res
      .status(201)
      .json({
        success: true,

        message:
          "Account created successfully",

        token,

        user: {
          id:
            createdUser.id,

          fullName:
            createdUser.fullName,

          name:
            createdUser.fullName,

          email:
            createdUser.email,

          role:
            "Learner",
        },
      });
  } catch (error) {
    console.error(
      "Register User Error:",
      error
    );

    if (
      error.code ===
      "ER_DUP_ENTRY"
    ) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "An account with this email already exists",
        });
    }

    if (
      error.code ===
      "ER_BAD_FIELD_ERROR"
    ) {
      return res
        .status(500)
        .json({
          success: false,

          message:
            "Users table column names do not match the backend code",
        });
    }

    return res
      .status(500)
      .json({
        success: false,

        message:
          error.message ||
          "Failed to create account",
      });
  }
};

/*
  Login registered user

  POST /api/auth/login
*/

const loginUser = async (
  req,
  res
) => {
  try {
    const {
      email,
      password,
    } = req.body;

    const normalizedEmail =
      normalizeEmail(email);

    const normalizedPassword =
      String(password || "");

    if (
      !normalizedEmail ||
      !normalizedPassword
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Email and password are required",
        });
    }

    const emailPattern =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailPattern.test(
        normalizedEmail
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Please enter a valid email address",
        });
    }

    const user =
      await findUserByEmail(
        normalizedEmail
      );

    if (!user) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "No registered account was found with this email",
        });
    }

    if (!user.password) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "This account does not have a valid password",
        });
    }

    const passwordMatches =
      await bcrypt.compare(
        normalizedPassword,
        user.password
      );

    if (
      !passwordMatches
    ) {
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Invalid email or password",
        });
    }

    const token =
      createAuthToken(user);

    return res
      .status(200)
      .json({
        success: true,

        message:
          "Login successful",

        token,

        user: {
          id: user.id,

          fullName:
            user.full_name,

          name:
            user.full_name,

          email:
            user.email,

          role:
            "Learner",
        },
      });
  } catch (error) {
    console.error(
      "Login User Error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          error.message ||
          "Login failed",
      });
  }
};

module.exports = {
  registerUser,
  loginUser,
};