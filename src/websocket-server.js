const WebSocket = require('ws');
const { EventEmitter } = require('events');

class VulnerabilityScannerWebSocket extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.wss = null;
        this.clients = new Map();
        this.scanSessions = new Map();
        this.activeScans = new Map();
    }

    start() {
        this.wss = new WebSocket.Server({ 
            port: process.env.WS_PORT || 3000,
            perMessageDeflate: false // Reduce detection footprint
        });

        this.wss.on('connection', (ws, request) => {
            this.handleConnection(ws, request);
        });

        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });

        console.log(`WebSocket server listening on port ${process.env.WS_PORT || 3000}`);
    }

    handleConnection(ws, request) {
        const clientId = this.generateClientId();
        const client = {
            id: clientId,
            ws: ws,
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            scanSession: null,
            metadata: this.extractClientMetadata(request)
        };

        this.clients.set(clientId, client);
        this.logConnection(client);

        ws.on('message', (data) => {
            this.handleMessage(client, data);
        });

        ws.on('close', () => {
            this.handleDisconnection(client);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error for client ${clientId}:`, error);
        });

        // Send welcome message with capabilities
        this.sendMessage(client, {
            type: 'connection_established',
            data: {
                timestamp: Date.now(),
                capabilities: [
                    'vulnerability_scan',
                    'price_manipulation',
                    'realtime_exploitation',
                    'stealth_mode'
                ],
                sessionId: clientId
            }
        });
    }

    handleMessage(client, data) {
        client.lastActivity = Date.now();
        
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (error) {
            this.sendError(client, 'Invalid JSON message');
            return;
        }

        this.processMessage(client, message);
    }

    async processMessage(client, message) {
        switch (message.type) {
            case 'start_vulnerability_scan':
                await this.handleVulnerabilityScan(client, message.data);
                break;
            case 'start_exploitation':
                await this.handleExploitation(client, message.data);
                break;
            case 'start_price_manipulation':
                await this.handlePriceManipulation(client, message.data);
                break;
            case 'emergency_stop':
                await this.handleEmergencyStop(client, message.data);
                break;
            default:
                this.sendError(client, `Unknown message type: ${message.type}`);
        }
    }

    async handleVulnerabilityScan(client, data) {
        const sessionId = this.generateSessionId();
        const scanTask = new VulnerabilityScanner(data, sessionId);
        
        this.activeScans.set(sessionId, scanTask);
        client.scanSession = sessionId;

        this.sendMessage(client, {
            type: 'scan_started',
            data: {
                sessionId: sessionId,
                targetUrl: data.targetUrl,
                scanType: data.scanDepth,
                startTime: Date.now()
            }
        });

        try {
            await scanTask.execute();
            
            this.sendMessage(client, {
                type: 'scan_complete',
                data: scanTask.getResults()
            });
        } catch (error) {
            this.sendError(client, `Scan failed: ${error.message}`);
        } finally {
            this.activeScans.delete(sessionId);
        }
    }

    sendMessage(client, message) {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }

    sendError(client, error) {
        this.sendMessage(client, {
            type: 'error',
            data: { error: error }
        });
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    extractClientMetadata(request) {
        return {
            ip: request.headers['x-forwarded-for'] || request.connection.remoteAddress,
            userAgent: request.headers['user-agent'],
            timestamp: Date.now()
        };
    }
}

module.exports = VulnerabilityScannerWebSocket;


