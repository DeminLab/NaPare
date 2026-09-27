import { BadGatewayException, BadRequestException } from "@nestjs/common";

import {
  MoodleConnectorService,
  normalizeMoodleBaseUrl,
} from "./moodle-connector.service";

describe("MoodleConnectorService", () => {
  const originalKey = process.env.CONNECTOR_ENCRYPTION_KEY;
  const service = new MoodleConnectorService();

  beforeEach(() => {
    process.env.CONNECTOR_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CONNECTOR_ENCRYPTION_KEY;
    else process.env.CONNECTOR_ENCRYPTION_KEY = originalKey;
    jest.restoreAllMocks();
  });

  it("normalizes a Moodle base URL and rejects insecure endpoints", () => {
    expect(normalizeMoodleBaseUrl("https://moodle.example.edu/moodle")).toBe(
      "https://moodle.example.edu/moodle/",
    );
    expect(() => normalizeMoodleBaseUrl("http://moodle.example.edu")).toThrow(
      BadRequestException,
    );
    expect(() => normalizeMoodleBaseUrl("https://localhost/moodle")).toThrow(
      BadRequestException,
    );
  });

  it("encrypts the token at rest and sends it only to Moodle on a connection test", async () => {
    const config = service.configure(
      "https://moodle.example.edu/moodle/",
      "moodle-super-secret-token",
    );
    expect(config.encryptedToken).not.toContain("moodle-super-secret-token");

    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          sitename: "University Moodle",
          username: "api-user",
          release: "4.5",
        }),
        { status: 200 },
      ),
    );
    await expect(service.testConnection(config)).resolves.toEqual({
      siteName: "University Moodle",
      userName: "api-user",
      release: "4.5",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "wsfunction=core_webservice_get_site_info",
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "wstoken=moodle-super-secret-token",
    );
  });

  it("surfaces Moodle API rejection without exposing the token", async () => {
    const config = service.configure(
      "https://moodle.example.edu/",
      "valid-token-value",
    );
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          exception: "invalid_response_exception",
          message: "Invalid token",
        }),
        {
          status: 200,
        },
      ),
    );

    await expect(service.testConnection(config)).rejects.toThrow(
      BadGatewayException,
    );
  });
});
