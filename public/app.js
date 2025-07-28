// WebRTC Video Chat Application
class WebRTCVideoChat {
    constructor() {
        this.socket = null;
        this.localStream = null;
        this.peerConnection = null;
        this.partnerId = null;
        this.roomId = null;
        this.isInitiator = false;
        this.localCandidates = 0;
        this.remoteCandidates = 0;

        // DOM elements
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.startButton = document.getElementById('startButton');
        this.nextButton = document.getElementById('nextButton');
        this.stopButton = document.getElementById('stopButton');
        this.connectionStatus = document.getElementById('connection-status');

        // WebRTC configuration with STUN servers
        this.rtcConfig = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        };

        this.initializeSocket();
        this.bindEvents();
        this.updateStatus('Connecting to server...', 'waiting');
    }

    // Initialize Socket.IO connection
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
            this.updateStatus('Connected to server. Click "Start Chat" to begin.', 'connected');
            this.updateUserId(this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from signaling server');
            this.updateStatus('Disconnected from server', 'error');
        });

        this.socket.on('waiting', () => {
            this.updateStatus('Waiting for a partner...', 'waiting');
            this.logSignaling('Waiting for partner to join');
        });

        this.socket.on('matched', (data) => {
            this.partnerId = data.partnerId;
            this.roomId = data.roomId;
            this.updatePartnerId(data.partnerId);
            this.updateRoomId(data.roomId);
            this.updateStatus('Partner found! Establishing connection...', 'connected');
            this.logSignaling(`Matched with partner: ${data.partnerId}`);
            
            // Start WebRTC connection
            this.startWebRTCConnection();
        });

        this.socket.on('offer', (data) => {
            this.logSignaling(`Received SDP offer from ${data.from}`);
            this.logSDP('Received Offer', data.offer);
            this.handleOffer(data.offer);
        });

        this.socket.on('answer', (data) => {
            this.logSignaling(`Received SDP answer from ${data.from}`);
            this.logSDP('Received Answer', data.answer);
            this.handleAnswer(data.answer);
        });

        this.socket.on('ice-candidate', (data) => {
            this.logSignaling(`Received ICE candidate from ${data.from}`);
            this.logICE('Received Candidate', data.candidate);
            this.handleIceCandidate(data.candidate);
        });

        this.socket.on('partner-left', () => {
            this.updateStatus('Partner disconnected', 'error');
            this.logSignaling('Partner left the chat');
            this.cleanupConnection();
        });
    }

    // Bind UI event listeners
    bindEvents() {
        this.startButton.addEventListener('click', () => this.startChat());
        this.nextButton.addEventListener('click', () => this.nextPartner());
        this.stopButton.addEventListener('click', () => this.stopChat());
    }

    // Start the chat process
    async startChat() {
        try {
            this.updateStatus('Getting camera access...', 'waiting');
            
            // Get user media (camera and microphone)
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            
            // Display local video
            this.localVideo.srcObject = this.localStream;
            
            // Join the chat room
            this.socket.emit('join-chat');
            
            this.startButton.disabled = true;
            this.updateStatus('Waiting for partner...', 'waiting');
            
        } catch (error) {
            console.error('Error accessing media devices:', error);
            this.updateStatus('Error accessing camera/microphone', 'error');
            this.logSignaling(`Error: ${error.message}`, 'error');
        }
    }

    // Start WebRTC peer connection
    startWebRTCConnection() {
        try {
            // Create RTCPeerConnection
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);
            
            // Add local stream tracks to peer connection
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });

            // Set up event handlers
            this.setupPeerConnectionHandlers();
            
            // Determine if we should create the offer
            this.isInitiator = this.socket.id < this.partnerId;
            
            if (this.isInitiator) {
                this.createOffer();
            }
            
        } catch (error) {
            console.error('Error creating peer connection:', error);
            this.logSignaling(`Error creating peer connection: ${error.message}`, 'error');
        }
    }

    // Set up RTCPeerConnection event handlers
    setupPeerConnectionHandlers() {
        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.localCandidates++;
                this.updateLocalCandidates();
                this.logICE('Local Candidate', event.candidate);
                this.socket.emit('ice-candidate', { candidate: event.candidate });
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            this.updateConnectionState(this.peerConnection.connectionState);
            this.logSignaling(`Connection state: ${this.peerConnection.connectionState}`);
            
            if (this.peerConnection.connectionState === 'connected') {
                this.updateStatus('Connected! Video chat is active.', 'connected');
                this.nextButton.disabled = false;
                this.stopButton.disabled = false;
            } else if (this.peerConnection.connectionState === 'failed') {
                this.updateStatus('Connection failed', 'error');
            }
        };

        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            this.updateIceConnectionState(this.peerConnection.iceConnectionState);
            this.logSignaling(`ICE connection state: ${this.peerConnection.iceConnectionState}`);
        };

        // Handle signaling state changes
        this.peerConnection.onsignalingstatechange = () => {
            this.updateSignalingState(this.peerConnection.signalingState);
            this.logSignaling(`Signaling state: ${this.peerConnection.signalingState}`);
        };

        // Handle incoming remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('Received remote stream');
            this.remoteVideo.srcObject = event.streams[0];
        };
    }

    // Create and send SDP offer
    async createOffer() {
        try {
            this.logSignaling('Creating SDP offer...');
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.logSDP('Local Offer', offer);
            this.socket.emit('offer', { offer: offer });
            this.logSignaling('SDP offer sent');
            
        } catch (error) {
            console.error('Error creating offer:', error);
            this.logSignaling(`Error creating offer: ${error.message}`, 'error');
        }
    }

    // Handle incoming SDP offer
    async handleOffer(offer) {
        try {
            this.logSignaling('Setting remote description (offer)...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            
            this.logSignaling('Creating SDP answer...');
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.logSDP('Local Answer', answer);
            this.socket.emit('answer', { answer: answer });
            this.logSignaling('SDP answer sent');
            
        } catch (error) {
            console.error('Error handling offer:', error);
            this.logSignaling(`Error handling offer: ${error.message}`, 'error');
        }
    }

    // Handle incoming SDP answer
    async handleAnswer(answer) {
        try {
            this.logSignaling('Setting remote description (answer)...');
            await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
            this.logSignaling('Remote description set successfully');
            
        } catch (error) {
            console.error('Error handling answer:', error);
            this.logSignaling(`Error handling answer: ${error.message}`, 'error');
        }
    }

    // Handle incoming ICE candidate
    async handleIceCandidate(candidate) {
        try {
            this.remoteCandidates++;
            this.updateRemoteCandidates();
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            this.logSignaling('ICE candidate added successfully');
            
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
            this.logSignaling(`Error adding ICE candidate: ${error.message}`, 'error');
        }
    }

    // Request next partner
    nextPartner() {
        this.socket.emit('next-partner');
        this.cleanupConnection();
        this.updateStatus('Looking for next partner...', 'waiting');
        this.nextButton.disabled = true;
        this.stopButton.disabled = true;
    }

    // Stop the chat
    stopChat() {
        this.cleanupConnection();
        this.updateStatus('Chat stopped. Click "Start Chat" to begin again.', 'waiting');
        this.startButton.disabled = false;
        this.nextButton.disabled = true;
        this.stopButton.disabled = true;
    }

    // Clean up WebRTC connection
    cleanupConnection() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        if (this.remoteVideo.srcObject) {
            this.remoteVideo.srcObject.getTracks().forEach(track => track.stop());
            this.remoteVideo.srcObject = null;
        }
        
        this.partnerId = null;
        this.roomId = null;
        this.isInitiator = false;
        this.localCandidates = 0;
        this.remoteCandidates = 0;
        
        this.updatePartnerId('-');
        this.updateRoomId('-');
        this.updateConnectionState('-');
        this.updateIceConnectionState('-');
        this.updateSignalingState('-');
        this.updateLocalCandidates();
        this.updateRemoteCandidates();
    }

    // UI update methods
    updateStatus(message, type) {
        const statusIcon = this.connectionStatus.querySelector('.status-icon');
        const statusText = this.connectionStatus.querySelector('.status-text');
        
        this.connectionStatus.className = `status ${type}`;
        statusText.textContent = message;
        
        switch (type) {
            case 'waiting':
                statusIcon.textContent = '⏳';
                break;
            case 'connected':
                statusIcon.textContent = '✅';
                break;
            case 'error':
                statusIcon.textContent = '❌';
                break;
        }
    }

    updateUserId(id) {
        document.getElementById('userId').textContent = id;
    }

    updatePartnerId(id) {
        document.getElementById('partnerId').textContent = id;
    }

    updateRoomId(id) {
        document.getElementById('roomId').textContent = id;
    }

    updateConnectionState(state) {
        document.getElementById('connectionState').textContent = state;
    }

    updateIceConnectionState(state) {
        document.getElementById('iceConnectionState').textContent = state;
    }

    updateSignalingState(state) {
        document.getElementById('signalingState').textContent = state;
    }

    updateLocalCandidates() {
        document.getElementById('localCandidates').textContent = this.localCandidates;
    }

    updateRemoteCandidates() {
        document.getElementById('remoteCandidates').textContent = this.remoteCandidates;
    }

    // Logging methods
    logSignaling(message, type = 'received') {
        const logElement = document.getElementById('signalingMessages');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        logElement.appendChild(logEntry);
        logElement.scrollTop = logElement.scrollHeight;
    }

    logICE(message, candidate) {
        const logElement = document.getElementById('iceMessages');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry received';
        logEntry.textContent = `[${timestamp}] ${message}: ${candidate.candidate || candidate}`;
        logElement.appendChild(logEntry);
        logElement.scrollTop = logElement.scrollHeight;
    }

    logSDP(message, sdp) {
        const logElement = document.getElementById('sdpMessages');
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry received';
        logEntry.textContent = `[${timestamp}] ${message}: ${sdp.type} - ${sdp.sdp.substring(0, 100)}...`;
        logElement.appendChild(logEntry);
        logElement.scrollTop = logElement.scrollHeight;
    }
}

// Debug tab functionality
function showTab(tabName) {
    // Hide all debug content
    const debugContents = document.querySelectorAll('.debug-content');
    debugContents.forEach(content => content.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab content
    document.getElementById(`${tabName}-log`).classList.add('active');
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new WebRTCVideoChat();
}); 