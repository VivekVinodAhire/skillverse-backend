const ai = require("../config/gemini");

const testGemini = async (req, res) => {
  try {
    const response =
      await ai.models.generateContent({
        model: "gemini-3.5-flash",

        contents:
          "Explain Java Programming in simple English within 100 words.",
      });

    return res.status(200).json({
      success: true,
      response: response.text,
    });
  } catch (error) {
    console.error(
      "Gemini API Error:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to get response from Gemini AI",
    });
  }
};

const listGeminiModels = async (req, res) => {
  try {
    /*
      models.list() returns a Promise.
      First await it to get the Pager.
    */

    const pager = await ai.models.list();

    const models = [];

    /*
      Pager can then be iterated.
    */

    for await (const model of pager) {
      const supportedActions =
        model.supportedActions || [];

      if (
        supportedActions.includes(
          "generateContent"
        )
      ) {
        models.push({
          name: model.name,
          displayName:
            model.displayName || model.name,

          description:
            model.description || "",

          inputTokenLimit:
            model.inputTokenLimit || null,

          outputTokenLimit:
            model.outputTokenLimit || null,

          supportedActions,
        });
      }
    }

    return res.status(200).json({
      success: true,
      total: models.length,
      models,
    });
  } catch (error) {
    console.error(
      "Gemini Model List Error:",
      error
    );

    return res.status(
      error.status || 500
    ).json({
      success: false,
      message:
        error.message ||
        "Failed to load Gemini models",
    });
  }
};

module.exports = {
  testGemini,
  listGeminiModels,
};