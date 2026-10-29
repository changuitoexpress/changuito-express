// Safe connectivity check: never prints the key or provider response payload.
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log(JSON.stringify({ configured: false }));
  process.exitCode = 1;
} else {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(10_000),
      },
    );
    const data = await response.json();
    console.log(
      JSON.stringify({
        configured: true,
        status: response.status,
        providerStatus: data.error?.status,
        flashModels: Array.isArray(data.models)
          ? data.models
              .filter(function (model) {
                return (
                  model.name?.includes("flash") &&
                  model.supportedGenerationMethods?.includes("generateContent")
                );
              })
              .map(function (model) {
                return model.name;
              })
          : [],
      }),
    );
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.log(
      JSON.stringify({
        configured: true,
        connectionError: error?.name ?? "UnknownError",
      }),
    );
    process.exitCode = 1;
  }
}
