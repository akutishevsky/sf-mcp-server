import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
// Importing exec from node:child_process to execute shell commands
import { execFile } from "node:child_process";

const server = new McpServer({
    name: "sf-mcp-server",
    version: "1.0.0",
    capabilities: {
        tools: {},
    },
});

const listConnectedSalesforceOrgs = async () => {
    return new Promise((resolve, reject) => {
        execFile("sf", ["org", "list", "--json"], (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            if (stderr) {
                return reject(new Error(stderr));
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
};

server.tool("list_connected_salesforce_orgs", {}, async () => {
    const orgList = await listConnectedSalesforceOrgs();
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(orgList, null, 2),
            },
        ],
    };
});

const executeSoqlQuery = async (
    targetOrg: string,
    sObject: string,
    fields: string,
    where?: string,
    orderBy?: string,
    limit?: number
) => {
    let query = `SELECT ${fields} FROM ${sObject}`;

    if (where) query += " WHERE " + where;
    if (limit) query += " LIMIT " + limit;
    if (orderBy) query += " ORDER BY " + orderBy;

    const args = [
        "data",
        "query",
        "--target-org",
        targetOrg,
        "--query",
        query,
        "--json",
    ];

    return new Promise((resolve, reject) => {
        execFile("sf", args, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            if (stderr) {
                return reject(new Error(stderr));
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result.result.records || []);
            } catch (parseError) {
                reject(parseError);
            }
        });
    });
};

server.tool(
    "query_records",
    "Execute a SOQL query in Salesforce Org",
    {
        input: z.object({
            targetOrg: z
                .string()
                .describe("Target Salesforce Org to execute the query against"),
            sObject: z.string().describe("Salesforce SObject to query from"),
            fields: z
                .string()
                .describe("Comma-separated list of fields to retrieve"),
            where: z
                .string()
                .optional()
                .describe("Optional WHERE clause for the query"),
            orderBy: z
                .string()
                .optional()
                .describe("Optional ORDER BY clause for the query"),
            limit: z
                .number()
                .optional()
                .describe("Optional limit for the number of records returned"),
        }),
    },
    async ({ input }) => {
        const { targetOrg, sObject, fields, where, orderBy, limit } = input;
        const result = await executeSoqlQuery(
            targetOrg,
            sObject,
            fields,
            where,
            orderBy,
            limit
        );

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Salesforce MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
