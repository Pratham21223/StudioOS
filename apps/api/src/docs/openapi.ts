import { env } from "../config/env.js";

const json = (description: string) => ({
  description,
  content: { "application/json": { schema: { type: "object" } } },
});

const error = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
});

const orgId = {
  name: "orgId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const clientId = {
  name: "clientId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const projectId = {
  name: "projectId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const contentId = {
  name: "contentId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const taskId = {
  name: "taskId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const assetId = {
  name: "assetId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const notificationId = {
  name: "notificationId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const membershipId = {
  name: "membershipId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};
const userId = {
  name: "userId",
  in: "path",
  required: true,
  schema: { type: "string", format: "uuid" },
};

const secured = [{ cookieAuth: [] }];
const securedWrite = [{ cookieAuth: [], csrfToken: [] }];

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "StudioOS API",
    version: "0.1.0",
    description:
      "Multi-tenant content production API. Cookie authentication is used for browser sessions. Unsafe requests also require the double-submit CSRF header. Errors share a stable envelope with a request ID.",
  },
  servers: [
    { url: `${env.API_BASE_URL ?? `http://localhost:${env.PORT}/api/v1`}`, description: "API v1" },
  ],
  tags: [
    { name: "Auth" },
    { name: "Organizations" },
    { name: "Clients" },
    { name: "Projects" },
    { name: "Content" },
    { name: "Tasks" },
    { name: "Assets" },
    { name: "Reviews" },
    { name: "Client portal" },
    { name: "Notifications" },
    { name: "Dashboard" },
    { name: "Health" },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: env.SESSION_COOKIE_NAME,
      },
      csrfToken: {
        type: "apiKey",
        in: "header",
        name: "X-CSRF-Token",
      },
    },
    schemas: {
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string" },
              requestId: { type: "string", format: "uuid" },
              details: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    message: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          status: { type: "string", enum: ["ACTIVE", "DEACTIVATED"] },
        },
      },
      Organization: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          slug: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "DEACTIVATED"] },
        },
      },
      Client: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          contactName: { type: "string", nullable: true },
          email: { type: "string", nullable: true },
          status: { type: "string", enum: ["ACTIVE", "ARCHIVED"] },
        },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "PAUSED", "COMPLETED"] },
          startDate: { type: "string", format: "date", nullable: true },
          deadline: { type: "string", format: "date", nullable: true },
        },
      },
      ContentItem: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          type: {
            type: "string",
            enum: ["VIDEO", "PODCAST", "SOCIAL_POST", "ARTICLE", "DESIGN", "OTHER"],
          },
          status: {
            type: "string",
            enum: [
              "BRIEF",
              "SCRIPT",
              "SHOOT",
              "EDITING",
              "INTERNAL_REVIEW",
              "CLIENT_APPROVAL",
              "READY_TO_PUBLISH",
            ],
          },
          deadline: { type: "string", format: "date", nullable: true },
          version: { type: "integer", minimum: 1 },
        },
      },
      Task: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          title: { type: "string" },
          status: { type: "string", enum: ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] },
          priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] },
          dueDate: { type: "string", format: "date", nullable: true },
        },
      },
      Asset: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          originalFilename: { type: "string" },
          mimeType: { type: "string" },
          sizeBytes: { type: "integer" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Review: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          decision: {
            type: "string",
            enum: ["INTERNAL_FEEDBACK", "CLIENT_APPROVED", "CLIENT_REVISION_REQUESTED"],
          },
          contentVersion: { type: "integer" },
          feedback: { type: "string", nullable: true },
        },
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          type: { type: "string" },
          title: { type: "string" },
          body: { type: "string", nullable: true },
          readAt: { type: "string", format: "date-time", nullable: true },
        },
      },
    },
  },
  security: secured,
  paths: {
    "/auth/csrf": {
      get: {
        tags: ["Auth"],
        summary: "Issue or reuse a CSRF token",
        security: [],
        responses: { "200": json("CSRF token") },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register a user and organization",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": json("Session created"), "400": error("Validation error") },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Sign in and rotate the session",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": json("Session created"),
          "401": error("Invalid credentials"),
          "429": error("Rate limited"),
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Sign out",
        security: securedWrite,
        responses: { "200": json("Signed out") },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user and active memberships",
        responses: { "200": json("Current session context"), "401": error("Not signed in") },
      },
    },
    "/auth/password/forgot": {
      post: {
        tags: ["Auth"],
        summary: "Request a password reset",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Always generic success"), "429": error("Rate limited") },
      },
    },
    "/auth/password/reset": {
      post: {
        tags: ["Auth"],
        summary: "Reset a password with a single-use token",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Password updated"), "400": error("Invalid token") },
      },
    },
    "/organizations": {
      get: {
        tags: ["Organizations"],
        summary: "List the current user's organizations",
        responses: { "200": json("Organizations") },
      },
    },
    "/organizations/{orgId}": {
      get: {
        tags: ["Organizations"],
        summary: "Get organization",
        parameters: [orgId],
        responses: { "200": json("Organization"), "404": error("Not found") },
      },
      patch: {
        tags: ["Organizations"],
        summary: "Update organization",
        security: securedWrite,
        parameters: [orgId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Organization updated"), "403": error("Forbidden") },
      },
    },
    "/organizations/{orgId}/members": {
      get: {
        tags: ["Organizations"],
        summary: "List internal members",
        parameters: [orgId],
        responses: { "200": json("Members") },
      },
    },
    "/organizations/{orgId}/members/{membershipId}": {
      patch: {
        tags: ["Organizations"],
        summary: "Update member role or status",
        security: securedWrite,
        parameters: [orgId, membershipId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Membership updated"), "409": error("Last-admin safeguard") },
      },
    },
    "/organizations/{orgId}/invitations": {
      get: {
        tags: ["Organizations"],
        summary: "List pending internal invitations",
        parameters: [orgId],
        responses: { "200": json("Invitations") },
      },
      post: {
        tags: ["Organizations"],
        summary: "Invite an internal member",
        security: securedWrite,
        parameters: [orgId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": json("Invitation created"), "409": error("Already a member") },
      },
    },
    "/organizations/{orgId}/clients": {
      get: {
        tags: ["Clients"],
        summary: "List clients",
        parameters: [orgId],
        responses: { "200": json("Clients"), "403": error("Forbidden") },
      },
      post: {
        tags: ["Clients"],
        summary: "Create a client",
        security: securedWrite,
        parameters: [orgId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": json("Client created") },
      },
    },
    "/organizations/{orgId}/clients/{clientId}": {
      get: {
        tags: ["Clients"],
        summary: "Get a client",
        parameters: [orgId, clientId],
        responses: { "200": json("Client"), "404": error("Not found") },
      },
      patch: {
        tags: ["Clients"],
        summary: "Update or archive a client",
        security: securedWrite,
        parameters: [orgId, clientId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Client updated") },
      },
    },
    "/organizations/{orgId}/clients/{clientId}/members": {
      get: {
        tags: ["Clients"],
        summary: "List client portal contacts",
        parameters: [orgId, clientId],
        responses: { "200": json("Client memberships") },
      },
    },
    "/organizations/{orgId}/clients/{clientId}/members/{membershipId}": {
      patch: {
        tags: ["Clients"],
        summary: "Activate or deactivate portal access",
        security: securedWrite,
        parameters: [orgId, clientId, membershipId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Client membership updated") },
      },
    },
    "/organizations/{orgId}/clients/{clientId}/invitations": {
      get: {
        tags: ["Clients"],
        summary: "List pending portal invitations",
        parameters: [orgId, clientId],
        responses: { "200": json("Invitations") },
      },
      post: {
        tags: ["Clients"],
        summary: "Invite a client contact",
        security: securedWrite,
        parameters: [orgId, clientId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": json("Invitation created"), "400": error("Client archived") },
      },
    },
    "/organizations/{orgId}/projects": {
      get: {
        tags: ["Projects"],
        summary: "List accessible projects",
        parameters: [orgId],
        responses: { "200": json("Projects") },
      },
      post: {
        tags: ["Projects"],
        summary: "Create a project",
        security: securedWrite,
        parameters: [orgId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": json("Project created"), "404": error("Client not found") },
      },
    },
    "/organizations/{orgId}/projects/{projectId}": {
      get: {
        tags: ["Projects"],
        summary: "Get a project",
        parameters: [orgId, projectId],
        responses: { "200": json("Project"), "404": error("Not found") },
      },
      patch: {
        tags: ["Projects"],
        summary: "Update project details or status",
        security: securedWrite,
        parameters: [orgId, projectId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Project updated"), "409": error("Project completed") },
      },
    },
    "/organizations/{orgId}/projects/{projectId}/members": {
      get: {
        tags: ["Projects"],
        summary: "List project team",
        parameters: [orgId, projectId],
        responses: { "200": json("Project members") },
      },
      post: {
        tags: ["Projects"],
        summary: "Add project team members",
        security: securedWrite,
        parameters: [orgId, projectId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Project members") },
      },
    },
    "/organizations/{orgId}/projects/{projectId}/members/{userId}": {
      delete: {
        tags: ["Projects"],
        summary: "Remove a project team member",
        security: securedWrite,
        parameters: [orgId, projectId, userId],
        responses: { "200": json("Member removed") },
      },
    },
    "/organizations/{orgId}/content-items": {
      get: {
        tags: ["Content"],
        summary: "List accessible content",
        parameters: [
          orgId,
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string" } },
          { name: "projectId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "assigneeId", in: "query", schema: { type: "string" } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": json("Content items") },
      },
    },
    "/organizations/{orgId}/content-items/{contentId}": {
      get: {
        tags: ["Content"],
        summary: "Get content",
        parameters: [orgId, contentId],
        responses: { "200": json("Content item"), "404": error("Not found") },
      },
      patch: {
        tags: ["Content"],
        summary: "Update content metadata only",
        security: securedWrite,
        parameters: [orgId, contentId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Content updated"), "409": error("Project completed") },
      },
    },
    "/organizations/{orgId}/content-items/{contentId}/transitions": {
      post: {
        tags: ["Content"],
        summary: "Request a fixed workflow transition",
        description:
          "Send expectedVersion from the loaded content item. Invalid state pairs, stale versions, and concurrent moves are rejected.",
        security: securedWrite,
        parameters: [orgId, contentId],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["toStatus"],
                properties: {
                  toStatus: {
                    type: "string",
                    enum: [
                      "SCRIPT",
                      "SHOOT",
                      "EDITING",
                      "INTERNAL_REVIEW",
                      "CLIENT_APPROVAL",
                      "READY_TO_PUBLISH",
                    ],
                  },
                  expectedVersion: { type: "integer", minimum: 1 },
                  note: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Transition applied"),
          "403": error("Role cannot perform transition"),
          "409": error("Invalid transition or stale version"),
        },
      },
    },
    "/organizations/{orgId}/content-items/{contentId}/events": {
      get: {
        tags: ["Content"],
        summary: "Workflow history",
        parameters: [orgId, contentId],
        responses: { "200": json("Workflow events") },
      },
    },
    "/organizations/{orgId}/content-items/{contentId}/assets": {
      get: {
        tags: ["Assets"],
        summary: "List assets for content",
        parameters: [orgId, contentId],
        responses: { "200": json("Assets") },
      },
    },
    "/organizations/{orgId}/content-items/{contentId}/reviews": {
      get: {
        tags: ["Reviews"],
        summary: "List reviews for content",
        parameters: [orgId, contentId],
        responses: { "200": json("Reviews") },
      },
      post: {
        tags: ["Reviews"],
        summary: "Record internal feedback",
        security: securedWrite,
        parameters: [orgId, contentId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": json("Review recorded") },
      },
    },
    "/organizations/{orgId}/projects/{projectId}/content-items": {
      get: {
        tags: ["Content"],
        summary: "List project content",
        parameters: [orgId, projectId],
        responses: { "200": json("Content items") },
      },
      post: {
        tags: ["Content"],
        summary: "Create content in a project",
        security: securedWrite,
        parameters: [orgId, projectId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": json("Content created") },
      },
    },
    "/organizations/{orgId}/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "List/filter tasks",
        parameters: [
          orgId,
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "priority", in: "query", schema: { type: "string" } },
          { name: "projectId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "contentItemId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "assigneeId", in: "query", schema: { type: "string" } },
          { name: "overdue", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": json("Tasks") },
      },
      post: {
        tags: ["Tasks"],
        summary: "Create a task",
        security: securedWrite,
        parameters: [orgId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "201": json("Task created") },
      },
    },
    "/organizations/{orgId}/tasks/{taskId}": {
      get: {
        tags: ["Tasks"],
        summary: "Get a task",
        parameters: [orgId, taskId],
        responses: { "200": json("Task") },
      },
      patch: {
        tags: ["Tasks"],
        summary: "Update task metadata",
        security: securedWrite,
        parameters: [orgId, taskId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Task updated") },
      },
    },
    "/organizations/{orgId}/tasks/{taskId}/status": {
      patch: {
        tags: ["Tasks"],
        summary: "Update task status",
        description:
          "Assignees can update their own task. Task managers can update any accessible task.",
        security: securedWrite,
        parameters: [orgId, taskId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Task status updated"), "403": error("Not assignee or manager") },
      },
    },
    "/organizations/{orgId}/assets": {
      get: {
        tags: ["Assets"],
        summary: "List accessible assets",
        parameters: [orgId],
        responses: { "200": json("Assets") },
      },
    },
    "/organizations/{orgId}/assets/upload-intents": {
      post: {
        tags: ["Assets"],
        summary: "Create a signed upload intent",
        security: securedWrite,
        parameters: [orgId],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["projectId", "originalFilename", "mimeType", "sizeBytes"],
                properties: {
                  projectId: { type: "string", format: "uuid" },
                  contentItemId: { type: "string", format: "uuid", nullable: true },
                  originalFilename: { type: "string" },
                  mimeType: { type: "string" },
                  sizeBytes: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          "201": json("Signed upload URL"),
          "400": error("Invalid file"),
          "503": error("Storage unavailable"),
        },
      },
    },
    "/organizations/{orgId}/assets/complete": {
      post: {
        tags: ["Assets"],
        summary: "Verify an upload and create the asset",
        security: securedWrite,
        parameters: [orgId],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "201": json("Asset created"),
          "409": error("Upload not found or already completed"),
        },
      },
    },
    "/organizations/{orgId}/assets/{assetId}": {
      get: {
        tags: ["Assets"],
        summary: "Get asset metadata",
        parameters: [orgId, assetId],
        responses: { "200": json("Asset"), "404": error("Not found") },
      },
    },
    "/organizations/{orgId}/assets/{assetId}/download-url": {
      post: {
        tags: ["Assets"],
        summary: "Create a signed download URL",
        security: securedWrite,
        parameters: [orgId, assetId],
        requestBody: {
          required: false,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Signed download URL"), "404": error("Not found") },
      },
    },
    "/organizations/{orgId}/reviews": {
      get: {
        tags: ["Reviews"],
        summary: "List organization reviews",
        parameters: [orgId],
        responses: { "200": json("Reviews") },
      },
    },
    "/organizations/{orgId}/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Role-aware dashboard",
        parameters: [orgId],
        responses: { "200": json("Dashboard metrics"), "403": error("Forbidden") },
      },
    },
    "/client-portal/projects": {
      get: {
        tags: ["Client portal"],
        summary: "List projects shared with the client contact",
        responses: { "200": json("Portal projects"), "403": error("Client access required") },
      },
    },
    "/client-portal/projects/{projectId}/content-items": {
      get: {
        tags: ["Client portal"],
        summary: "List visible deliverables in a portal project",
        parameters: [projectId],
        responses: { "200": json("Portal content"), "404": error("Not found") },
      },
    },
    "/client-portal/content-items/{contentId}": {
      get: {
        tags: ["Client portal"],
        summary: "View a submitted deliverable",
        parameters: [contentId],
        responses: { "200": json("Portal content"), "404": error("Not found") },
      },
    },
    "/client-portal/content-items/{contentId}/approve": {
      post: {
        tags: ["Client portal"],
        summary: "Approve the submitted version",
        security: securedWrite,
        parameters: [contentId],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["expectedVersion"],
                properties: {
                  expectedVersion: { type: "integer", minimum: 1 },
                  assetId: { type: "string", format: "uuid", nullable: true },
                  feedback: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Approved"),
          "409": error("Not awaiting approval or stale version"),
        },
      },
    },
    "/client-portal/content-items/{contentId}/request-revision": {
      post: {
        tags: ["Client portal"],
        summary: "Request a revision with feedback",
        security: securedWrite,
        parameters: [contentId],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["expectedVersion", "feedback"],
                properties: {
                  expectedVersion: { type: "integer", minimum: 1 },
                  assetId: { type: "string", format: "uuid", nullable: true },
                  feedback: { type: "string", minLength: 1 },
                },
              },
            },
          },
        },
        responses: {
          "200": json("Revision requested"),
          "400": error("Feedback required"),
          "409": error("Stale version"),
        },
      },
    },
    "/client-portal/assets/{assetId}/download-url": {
      post: {
        tags: ["Client portal"],
        summary: "Signed download for a shared deliverable",
        security: securedWrite,
        parameters: [assetId],
        responses: { "200": json("Signed download URL"), "404": error("Not found") },
      },
    },
    "/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List the current user's notifications",
        parameters: [
          { name: "unread", in: "query", schema: { type: "string", enum: ["true", "false"] } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
        ],
        responses: { "200": json("Notifications and unread count") },
      },
    },
    "/notifications/{notificationId}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark one notification read",
        security: securedWrite,
        parameters: [notificationId],
        responses: { "200": json("Notification"), "404": error("Not found") },
      },
    },
    "/notifications/read-all": {
      post: {
        tags: ["Notifications"],
        summary: "Mark all notifications read",
        security: securedWrite,
        responses: { "200": json("Updated count") },
      },
    },
    "/invitations/{token}": {
      get: {
        tags: ["Auth"],
        summary: "Public invitation preview",
        security: [],
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": json("Invitation preview"), "404": error("Not found") },
      },
    },
    "/invitations/accept": {
      post: {
        tags: ["Auth"],
        summary: "Accept an internal or client invitation",
        security: [],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": json("Session created"), "409": error("Already accepted") },
      },
    },
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Liveness",
        security: [],
        responses: { "200": json("Alive") },
      },
    },
  },
} as const;

export type OpenApiSpec = typeof openApiSpec;
