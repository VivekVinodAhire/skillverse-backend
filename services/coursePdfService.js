import api from "./api";

const getStoredUser = () => {
  try {
    const storedUser =
      sessionStorage.getItem(
        "skillverseUser"
      ) ||
      localStorage.getItem(
        "skillverseUser"
      );

    if (!storedUser) {
      return null;
    }

    return JSON.parse(
      storedUser
    );
  } catch (error) {
    console.error(
      "Failed to read stored user:",
      error
    );

    return null;
  }
};

export const getCurrentUserId =
  () => {
    const storedUser =
      getStoredUser();

    const rawUserId =
      sessionStorage.getItem(
        "userId"
      ) ||
      localStorage.getItem(
        "userId"
      ) ||
      storedUser?.id ||
      storedUser?.userId;

    const userId =
      Number(rawUserId);

    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {
      return null;
    }

    return userId;
  };

const requireUserId = (
  providedUserId
) => {
  const userId =
    Number(
      providedUserId
    ) ||
    getCurrentUserId();

  if (
    !Number.isInteger(
      userId
    ) ||
    userId <= 0
  ) {
    throw new Error(
      "Your login session is invalid. Please log in again."
    );
  }

  return userId;
};

const requirePositiveId = (
  value,
  errorMessage
) => {
  const id =
    Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new Error(
      errorMessage
    );
  }

  return id;
};

/*
  Start background generation
*/

export const generateCourse =
  async (
    courseData
  ) => {
    const userId =
      requireUserId(
        courseData?.userId
      );

    const response =
      await api.post(
        "/courses/generate",
        {
          ...courseData,
          userId,
        },
        {
          timeout:
            30000,
        }
      );

    return response.data;
  };

/*
  Poll generation status
*/

export const getCourseGenerationStatus =
  async ({
    jobId,
    userId:
      providedUserId,
  }) => {
    const validJobId =
      requirePositiveId(
        jobId,
        "A valid generation job ID is required."
      );

    const userId =
      requireUserId(
        providedUserId
      );

    const response =
      await api.get(
        `/courses/generation/${validJobId}`,
        {
          params: {
            userId,
          },

          timeout:
            30000,
        }
      );

    return response.data;
  };

/*
  Resume failed generation
*/

export const resumeCourseGeneration =
  async ({
    jobId,
    userId:
      providedUserId,
  }) => {
    const validJobId =
      requirePositiveId(
        jobId,
        "A valid generation job ID is required."
      );

    const userId =
      requireUserId(
        providedUserId
      );

    const response =
      await api.post(
        `/courses/generation/${validJobId}/resume`,
        {
          userId,
        },
        {
          timeout:
            30000,
        }
      );

    return response.data;
  };

export const getAllCourses =
  async () => {
    const response =
      await api.get(
        "/courses"
      );

    return response.data;
  };

export const getMyCourses =
  async (
    providedUserId
  ) => {
    const userId =
      requireUserId(
        providedUserId
      );

    const response =
      await api.get(
        "/courses/my-courses",
        {
          params: {
            userId,
          },
        }
      );

    return response.data;
  };

export const getCourseById =
  async (
    courseId
  ) => {
    const validCourseId =
      requirePositiveId(
        courseId,
        "A valid course ID is required."
      );

    const response =
      await api.get(
        `/courses/${validCourseId}`
      );

    return response.data;
  };

export const deleteMyCourse =
  async ({
    courseId,
    userId:
      providedUserId,
  }) => {
    const validCourseId =
      requirePositiveId(
        courseId,
        "A valid course ID is required."
      );

    const userId =
      requireUserId(
        providedUserId
      );

    const response =
      await api.delete(
        `/courses/${validCourseId}`,
        {
          params: {
            userId,
          },
        }
      );

    return response.data;
  };

export const getMyLessons =
  async ({
    userId:
      providedUserId,
    courseId,
  } = {}) => {
    const userId =
      requireUserId(
        providedUserId
      );

    const params = {
      userId,
    };

    const validCourseId =
      Number(courseId);

    if (
      Number.isInteger(
        validCourseId
      ) &&
      validCourseId > 0
    ) {
      params.courseId =
        validCourseId;
    }

    const response =
      await api.get(
        "/lessons/my-lessons",
        {
          params,
        }
      );

    return response.data;
  };

export const getLessonById =
  async (
    lessonId
  ) => {
    const validLessonId =
      requirePositiveId(
        lessonId,
        "A valid lesson ID is required."
      );

    const userId =
      requireUserId();

    const response =
      await api.get(
        `/lessons/${validLessonId}`,
        {
          params: {
            userId,
          },
        }
      );

    return response.data;
  };

export const getLessonProgress =
  async ({
    lessonId,
    userId:
      providedUserId,
  }) => {
    const validLessonId =
      requirePositiveId(
        lessonId,
        "A valid lesson ID is required."
      );

    const userId =
      requireUserId(
        providedUserId
      );

    const response =
      await api.get(
        `/progress/lessons/${validLessonId}`,
        {
          params: {
            userId,
          },
        }
      );

    return response.data;
  };

export const updateLessonProgress =
  async ({
    lessonId,
    courseId,
    userId:
      providedUserId,
    isCompleted,
  }) => {
    const validLessonId =
      requirePositiveId(
        lessonId,
        "A valid lesson ID is required."
      );

    const validCourseId =
      requirePositiveId(
        courseId,
        "A valid course ID is required."
      );

    const userId =
      requireUserId(
        providedUserId
      );

    const response =
      await api.post(
        `/progress/lessons/${validLessonId}`,
        {
          userId,
          courseId:
            validCourseId,
          isCompleted:
            Boolean(
              isCompleted
            ),
        }
      );

    return response.data;
  };

export const getCourseProgress =
  async ({
    courseId,
    userId:
      providedUserId,
  }) => {
    const validCourseId =
      requirePositiveId(
        courseId,
        "A valid course ID is required."
      );

    const userId =
      requireUserId(
        providedUserId
      );

    const response =
      await api.get(
        `/progress/courses/${validCourseId}`,
        {
          params: {
            userId,
          },
        }
      );

    return response.data;
  };

export const downloadCourseNotesPdf =
  async (
    courseId
  ) => {
    const validCourseId =
      requirePositiveId(
        courseId,
        "A valid course ID is required."
      );

    const userId =
      requireUserId();

    try {
      const response =
        await api.get(
          `/courses/${validCourseId}/download-notes`,
          {
            params: {
              userId,
            },

            responseType:
              "blob",

            timeout:
              360000,
          }
        );

      const contentDisposition =
        response.headers[
          "content-disposition"
        ] || "";

      const encodedFileNameMatch =
        contentDisposition.match(
          /filename\*=UTF-8''([^;]+)/i
        );

      const standardFileNameMatch =
        contentDisposition.match(
          /filename="?([^";]+)"?/i
        );

      let fileName =
        `skillverse-course-${validCourseId}-notes.pdf`;

      if (
        encodedFileNameMatch?.[1]
      ) {
        fileName =
          decodeURIComponent(
            encodedFileNameMatch[1]
          );
      } else if (
        standardFileNameMatch?.[1]
      ) {
        fileName =
          standardFileNameMatch[1];
      }

      const pdfBlob =
        new Blob(
          [
            response.data,
          ],
          {
            type:
              "application/pdf",
          }
        );

      const downloadUrl =
        window.URL.createObjectURL(
          pdfBlob
        );

      const downloadLink =
        document.createElement(
          "a"
        );

      downloadLink.href =
        downloadUrl;

      downloadLink.download =
        fileName;

      document.body.appendChild(
        downloadLink
      );

      downloadLink.click();

      downloadLink.remove();

      window.setTimeout(
        () => {
          window.URL.revokeObjectURL(
            downloadUrl
          );
        },
        1000
      );

      return {
        success: true,
        fileName,
      };
    } catch (error) {
      if (
        error.response
          ?.data instanceof
        Blob
      ) {
        const responseText =
          await error.response.data
            .text();

        try {
          const responseData =
            JSON.parse(
              responseText
            );

          throw new Error(
            responseData.message ||
              "Failed to download course notes."
          );
        } catch (
          parseError
        ) {
          if (
            parseError instanceof
            SyntaxError
          ) {
            throw new Error(
              "Failed to download course notes."
            );
          }

          throw parseError;
        }
      }

      throw error;
    }
  };