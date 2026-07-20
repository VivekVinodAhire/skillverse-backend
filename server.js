const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

dotenv.config();

const {
  connectDatabase,
} = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const aiRoutes = require("./routes/aiRoutes");
const aiTutorRoutes = require("./routes/aiTutorRoutes");
const courseRoutes = require("./routes/courseRoutes");
const lessonRoutes = require("./routes/lessonRoutes");
const progressRoutes = require("./routes/progressRoutes");
const quizRoutes = require("./routes/quizRoutes");

const app = express();

const PORT = Number(
  process.env.PORT || 5000
);

const normalizeOrigin = (value) =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const configuredFrontendOrigins =
  String(
    process.env.FRONTEND_URL || ""
  )
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://skillverse-frontend-fawn.vercel.app",
  ...configuredFrontendOrigins,
];

const uniqueAllowedOrigins = [
  ...new Set(allowedOrigins),
];

const isAllowedOrigin = (origin) => {
  const normalizedOrigin =
    normalizeOrigin(origin);

  if (
    uniqueAllowedOrigins.includes(
      normalizedOrigin
    )
  ) {
    return true;
  }

  const isSkillVerseVercelDomain =
    /^https:\/\/skillverse-frontend(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(
      normalizedOrigin
    );

  return isSkillVerseVercelDomain;
};

const corsOptions = {
  origin: (origin, callback) => {
    /*
      Postman, Railway health checks,
      server-to-server requests आणि
      mobile clients मध्ये origin नसू शकतो.
    */
    if (!origin) {
      return callback(null, true);
    }

    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    const normalizedOrigin =
      normalizeOrigin(origin);

    console.warn(
      `Blocked CORS origin: ${normalizedOrigin}`
    );

    const corsError = new Error(
      `CORS blocked for origin: ${normalizedOrigin}`
    );

    corsError.status = 403;

    return callback(corsError);
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],

  exposedHeaders: [
    "Content-Disposition",
  ],

  optionsSuccessStatus: 204,

  maxAge: 86400,
};

app.disable("x-powered-by");

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin",
    },

    contentSecurityPolicy: false,
  })
);

/*
  CORS middleware routes च्या आधी असणे आवश्यक आहे.
*/
app.use(cors(corsOptions));

/*
  Express 5 मध्ये app.options("*", ...)
  path-to-regexp error देऊ शकतो.
  त्यामुळे global cors middleware पुरेसा आहे.
*/

app.use(
  morgan(
    process.env.NODE_ENV ===
      "production"
      ? "combined"
      : "dev"
  )
);

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

app.use(cookieParser());

app.get("/", (req, res) => {
  return res.status(200).json({
    success: true,

    message:
      "SkillVerse backend is running",

    environment:
      process.env.NODE_ENV ||
      "development",

    timestamp:
      new Date().toISOString(),
  });
});

app.get(
  "/api/health",
  (req, res) => {
    return res.status(200).json({
      success: true,

      message:
        "SkillVerse API is healthy",

      environment:
        process.env.NODE_ENV ||
        "development",

      timestamp:
        new Date().toISOString(),

      allowedOrigins:
        uniqueAllowedOrigins,
    });
  }
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/ai",
  aiRoutes
);

app.use(
  "/api/ai-tutor",
  aiTutorRoutes
);

app.use(
  "/api/courses",
  courseRoutes
);

app.use(
  "/api/lessons",
  lessonRoutes
);

app.use(
  "/api/progress",
  progressRoutes
);

app.use(
  "/api/quizzes",
  quizRoutes
);

app.use((req, res) => {
  return res.status(404).json({
    success: false,

    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use(
  (
    error,
    req,
    res,
    next
  ) => {
    console.error(
      "Global Server Error:",
      error
    );

    const statusCode = Number(
      error.status ||
        error.statusCode ||
        500
    );

    return res
      .status(statusCode)
      .json({
        success: false,

        message:
          error.message ||
          "Internal server error",

        ...(process.env.NODE_ENV !==
          "production" && {
          stack: error.stack,
        }),
      });
  }
);

const startServer = async () => {
  try {
    await connectDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `🚀 Server running on port ${PORT}`
        );

        console.log(
          `🌐 Allowed origins: ${uniqueAllowedOrigins.join(
            ", "
          )}`
        );

        console.log(
          "🔗 Health check: /api/health"
        );
      }
    );
  } catch (error) {
    console.error(
      "❌ Server Startup Error:",
      error
    );

    process.exit(1);
  }
};

startServer();