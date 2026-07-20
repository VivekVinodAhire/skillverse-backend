const express = require(
  "express"
);

const {
  registerUser,
  loginUser,
} = require(
  "../controllers/authController"
);

const router =
  express.Router();

/*
  Register user

  POST /api/auth/register
*/

router.post(
  "/register",
  registerUser
);

/*
  Login registered user

  POST /api/auth/login
*/

router.post(
  "/login",
  loginUser
);

module.exports = router;