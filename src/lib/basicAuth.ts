export function getProjectApiAuthHeader() {
  const username = process.env.PROJECT_API_USERNAME;
  const password = process.env.PROJECT_API_PASSWORD;

  if (!username || !password) {
    throw new Error("Missing PROJECT_API_USERNAME / PROJECT_API_PASSWORD");
  }

  const token = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${token}`;
}

export function getProjectApiUrl(company?: string) {
  const apiUrl = process.env.PROJECT_API_URL;

  if (!apiUrl) {
    throw new Error("Missing PROJECT_API_URL");
  }

  const url = new URL(apiUrl);

  if (company) {
    url.searchParams.set("Company", company);
  } else if (process.env.PROJECT_API_DEFAULT_COMPANY) {
    url.searchParams.set("Company", process.env.PROJECT_API_DEFAULT_COMPANY);
  }

  return url.toString();
}
