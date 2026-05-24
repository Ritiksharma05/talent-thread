import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { EventEmitter } = require("node:events");
const { handleRequest } = require("../server.js");

class MockRequest extends EventEmitter {
  constructor(request, bodyBuffer) {
    super();
    const url = new URL(request.url);

    this.method = request.method;
    this.url = `${url.pathname}${url.search}`;
    this.headers = Object.fromEntries(request.headers.entries());
    this.headers.host = this.headers.host || url.host;
    this._bodyBuffer = bodyBuffer;
    this._destroyed = false;
  }

  start() {
    if (this._destroyed) {
      return;
    }

    queueMicrotask(() => {
      if (this._destroyed) {
        return;
      }

      if (this._bodyBuffer.length) {
        this.emit("data", this._bodyBuffer);
      }

      this.emit("end");
    });
  }

  destroy(error) {
    this._destroyed = true;
    if (error) {
      this.emit("error", error);
    }
  }
}

class MockResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.chunks = [];
    this.finished = new Promise((resolve) => {
      this._resolve = resolve;
    });
  }

  writeHead(statusCode, headers = {}) {
    this.statusCode = statusCode;
    this.headers = { ...this.headers, ...headers };
  }

  end(chunk) {
    if (typeof chunk !== "undefined") {
      this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    }

    this._resolve();
  }

  toResponse() {
    const body = this.chunks.length ? Buffer.concat(this.chunks) : null;
    return new Response(body, {
      headers: this.headers,
      status: this.statusCode
    });
  }
}

export default {
  async fetch(request) {
    const bodyBuffer = Buffer.from(await request.arrayBuffer());
    const mockRequest = new MockRequest(request, bodyBuffer);
    const mockResponse = new MockResponse();

    const work = Promise.resolve(handleRequest(mockRequest, mockResponse));
    mockRequest.start();

    await Promise.all([work, mockResponse.finished]);
    return mockResponse.toResponse();
  }
};
