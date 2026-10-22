import { BadGatewayException, BadRequestException } from "@nestjs/common";
import * as dns from "node:dns/promises";
import * as https from "node:https";
import { ClientRequest, IncomingMessage } from "node:http";
import { EventEmitter } from "node:events";

import {
  MoodleConnectorService,
  normalizeMoodleBaseUrl,
} from "./moodle-connector.service";

describe("MoodleConnectorService", () => {
  const originalKey = process.env.CONNECTOR_ENCRYPTION_KEY;
  const service = new MoodleConnectorService();
  let responseBody: unknown;

  beforeEach(() => {
    responseBody = { sitename: "University Moodle", username: "api-user", release: "4.5" };
    jest.spyOn(dns, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as never);
    jest.spyOn(https, "request").mockImplementation(((
      _url: URL,
      _options: https.RequestOptions,
      onResponse: (response: IncomingMessage) => void,
    ) => {
      const transport = new EventEmitter() as ClientRequest;
      transport.setTimeout = jest.fn().mockReturnValue(transport);
      transport.destroy = jest.fn().mockImplementation(error => { transport.emit("error", error); return transport; });
      transport.end = jest.fn().mockImplementation(() => {
        const response = new EventEmitter() as IncomingMessage;
        response.statusCode = 200;
        onResponse(response);
        response.emit("data", JSON.stringify(responseBody));
        response.emit("end");
        return transport;
      });
      return transport;
    }) as typeof https.request);
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

    await expect(service.testConnection(config)).resolves.toEqual({
      siteName: "University Moodle",
      userName: "api-user",
      release: "4.5",
    });
    expect(String(jest.mocked(https.request).mock.calls[0][0])).toContain(
      "wsfunction=core_webservice_get_site_info",
    );
    expect(String(jest.mocked(https.request).mock.calls[0][0])).toContain(
      "wstoken=moodle-super-secret-token",
    );
  });

  it("surfaces Moodle API rejection without exposing the token", async () => {
    const config = service.configure(
      "https://moodle.example.edu/",
      "valid-token-value",
    );
    responseBody = { exception: "invalid_response_exception", message: "Invalid token" };

    await expect(service.testConnection(config)).rejects.toThrow(
      BadGatewayException,
    );
    expect(https.request).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["127.0.0.1", 4], ["10.20.30.40", 4], ["169.254.169.254", 4],
    ["::1", 6], ["fe80::1", 6], ["::ffff:127.0.0.1", 6], ["::ffff:93.184.216.34", 6],
  ])("rejects blocked DNS target %s before opening the transport", async (address, family) => {
    jest.mocked(dns.lookup).mockResolvedValue([{ address, family }] as never);
    const config = service.configure("https://moodle.example.edu/", "valid-token-value");
    await expect(service.testConnection(config)).rejects.toThrow(BadRequestException);
    expect(https.request).not.toHaveBeenCalled();
  });

  it("allows public IPv6 and pins the checked DNS addresses for the HTTPS request", async () => {
    const addresses = [{ address: "2606:4700:4700::1111", family: 6 }];
    jest.mocked(dns.lookup).mockResolvedValue(addresses as never);
    const config = service.configure("https://moodle.example.edu/", "valid-token-value");
    await expect(service.testConnection(config)).resolves.toMatchObject({ siteName: "University Moodle" });
    const options = jest.mocked(https.request).mock.calls[0][1] as https.RequestOptions;
    const callback = jest.fn();
    options.lookup!("moodle.example.edu", { all: true }, callback);
    expect(callback).toHaveBeenCalledWith(null, addresses);
  });

  it('reads the native course array only for the enrollment function and sends an explicit student ID', async () => {
    const config = service.configure('https://moodle.example.edu/', 'valid-token-value');
    responseBody = [{ id: 11, fullname: 'Course' }];
    await expect(service.getUserCourses(config, 17)).resolves.toEqual(responseBody);
    const url = jest.mocked(https.request).mock.calls[0][0] as URL;
    expect(url.searchParams.get('wsfunction')).toBe('core_enrol_get_users_courses');
    expect(url.searchParams.get('userid')).toBe('17');
    await expect(service.testConnection(config)).rejects.toThrow(BadGatewayException);
    await expect(service.getUserCourses(config, 0)).rejects.toThrow(BadRequestException);
  });
  it('requires the exact single student/course grade report and rejects warnings', async () => {
    const config = service.configure('https://moodle.example.edu/', 'valid-token-value');
    responseBody = { usergrades: [{ userid: 17, courseid: 11, gradeitems: [{ id: 1, graderaw: 0 }] }], warnings: [] };
    await expect(service.getUserGradeItems(config, 17, 11)).resolves.toEqual([{ id: 1, graderaw: 0 }]);
    responseBody = { usergrades: [{ userid: 18, courseid: 11, gradeitems: [] }] };
    await expect(service.getUserGradeItems(config, 17, 11)).rejects.toThrow(BadGatewayException);
    responseBody = { usergrades: [], warnings: [{ warningcode: 'partial' }] };
    await expect(service.getUserGradeItems(config, 17, 11)).rejects.toThrow(BadGatewayException);
  });

  it("rejects mixed public/private DNS responses and DNS failures", async () => {
    const config = service.configure("https://moodle.example.edu/", "valid-token-value");
    jest.mocked(dns.lookup).mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }] as never);
    await expect(service.testConnection(config)).rejects.toThrow(BadRequestException);
    jest.mocked(dns.lookup).mockRejectedValue(new Error("DNS unavailable"));
    await expect(service.testConnection(config)).rejects.toThrow(BadGatewayException);
    expect(https.request).not.toHaveBeenCalled();
  });
});
