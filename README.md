# WebRTC Video Chat Application (Omegle-like)

A complete WebRTC peer-to-peer video chat application that demonstrates all the core concepts of WebRTC technology. This application includes a signaling server, STUN server configuration, and a modern web interface with real-time debugging capabilities.

## 🎯 What is WebRTC?

WebRTC (Web Real-Time Communication) is a free, open-source project that enables real-time communication capabilities directly in web browsers and mobile applications. It allows for peer-to-peer audio, video, and data sharing without requiring plugins or native apps.

## 🏗️ Architecture Overview

### Core Components

1. **Signaling Server** (`server.js`)
   - Built with Express.js and Socket.IO
   - Handles user matching and message relay
   - Manages room creation and cleanup

2. **WebRTC Client** (`public/app.js`)
   - Implements the complete WebRTC API
   - Handles media capture and peer connections
   - Manages signaling and ICE candidate exchange

3. **Modern UI** (`public/index.html`, `public/styles.css`)
   - Responsive design with real-time status updates
   - Debug panels for monitoring WebRTC states
   - Professional video chat interface

## 🔄 WebRTC Connection Flow

### 1. Signaling Process
```
User A                    Signaling Server                    User B
   |                           |                                |
   |-- join-chat ------------>|                                |
   |                          |<-- join-chat ------------------|
   |                          |                                |
   |<-- matched -------------|                                |
   |                          |-- matched -------------------->|
```

### 2. SDP Exchange
```
User A (Initiator)           Signaling Server           User B (Receiver)
   |                              |                           |
   |-- SDP Offer --------------->|                           |
   |                              |-- SDP Offer ------------>|
   |                              |<-- SDP Answer -----------|
   |<-- SDP Answer --------------|                           |
```

### 3. ICE Candidate Exchange
```
User A                    Signaling Server                    User B
   |                           |                                |
   |-- ICE Candidate --------->|                                |
   |                           |-- ICE Candidate ------------>|
   |                           |<-- ICE Candidate ------------|
   |<-- ICE Candidate ---------|                                |
   |                           |                                |
   |-- ICE Candidate --------->|                                |
   |                           |-- ICE Candidate ------------>|
   |                           |                                |
```

### 4. Peer-to-Peer Connection
Once enough ICE candidates are exchanged and the best path is found, the browsers establish a direct connection for video/audio streaming.

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Modern web browser with WebRTC support

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/GurukantPatil01/Omegle-V1-.git
   cd Omegle-V1-
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open the application**
   - Open your browser and navigate to `http://localhost:3001`
   - Allow camera and microphone access when prompted
   - Open another browser tab/window to test with a second user

## 🎮 How to Use

### Basic Usage
1. **Start Chat**: Click the "Start Chat" button to begin
2. **Wait for Partner**: The app will automatically match you with another user
3. **Video Chat**: Once connected, you'll see both your video and your partner's video
4. **Next Partner**: Click "Next Partner" to connect with a different user
5. **Stop**: Click "Stop" to end the current session

### Debug Features
The application includes comprehensive debugging tools:

- **Signaling Tab**: Shows all signaling messages exchanged
- **ICE Candidates Tab**: Displays ICE candidate information
- **SDP Tab**: Shows Session Description Protocol details
- **Connection Info**: Real-time connection state monitoring

## 🔧 Technical Details

### WebRTC Configuration

The application uses Google's public STUN servers for NAT traversal:

```javascript
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
    ]
};
```

### Key WebRTC APIs Used

1. **`navigator.mediaDevices.getUserMedia()`**
   - Captures local audio and video streams

2. **`RTCPeerConnection`**
   - Manages the peer-to-peer connection
   - Handles SDP negotiation and ICE candidate gathering

3. **`RTCSessionDescription`**
   - Represents SDP offers and answers

4. **`RTCIceCandidate`**
   - Represents network connectivity candidates

### Connection States

The application monitors several WebRTC connection states:

- **Connection State**: `new`, `connecting`, `connected`, `disconnected`, `failed`, `closed`
- **ICE Connection State**: `new`, `checking`, `connected`, `completed`, `failed`, `disconnected`, `closed`
- **Signaling State**: `stable`, `have-local-offer`, `have-remote-offer`, `have-local-pranswer`, `have-remote-pranswer`, `closed`

## 🌐 Network Considerations

### STUN vs TURN Servers

- **STUN Servers**: Help discover public IP addresses (used in this demo)
- **TURN Servers**: Provide relay functionality when direct connection fails

For production applications, you should:
1. Add TURN servers to handle restrictive firewalls
2. Use your own STUN/TURN servers for better reliability
3. Implement proper authentication and rate limiting

### NAT Types and Connectivity

Different NAT types affect WebRTC connectivity:

- **Full Cone NAT**: Most permissive, direct connections usually work
- **Restricted Cone NAT**: Requires previous communication
- **Port Restricted Cone NAT**: More restrictive
- **Symmetric NAT**: Most restrictive, often requires TURN relay

## 🔒 Security Considerations

### Media Security
- WebRTC automatically encrypts all media using SRTP (Secure Real-time Transport Protocol)
- DTLS (Datagram Transport Layer Security) is used for data channels

### Signaling Security
- The signaling server should use HTTPS in production
- Implement proper authentication and authorization
- Validate all incoming messages

### Privacy
- Always inform users about camera/microphone access
- Implement proper consent mechanisms
- Consider recording policies and legal requirements

## 🚀 Production Deployment

### Server Requirements
- Node.js server with Socket.IO
- HTTPS certificate (required for WebRTC in production)
- TURN server for reliable connectivity
- Load balancing for multiple users

### Scaling Considerations
- Use Redis for Socket.IO session storage
- Implement proper room management
- Add monitoring and logging
- Consider using a CDN for static assets

## 🐛 Troubleshooting

### Common Issues

1. **Camera/Microphone Access Denied**
   - Ensure HTTPS is used (required for getUserMedia)
   - Check browser permissions
   - Verify camera/microphone availability

2. **Connection Fails**
   - Check firewall settings
   - Verify STUN/TURN server availability
   - Monitor browser console for errors

3. **Poor Video Quality**
   - Check network bandwidth
   - Verify camera resolution settings
   - Monitor WebRTC statistics

### Debug Tools
- Use the built-in debug panels to monitor connection states
- Check browser developer tools console
- Monitor network tab for signaling messages

## 📚 Learning Resources

- [WebRTC Official Documentation](https://webrtc.org/)
- [MDN WebRTC Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [Socket.IO Documentation](https://socket.io/docs/)

## 🤝 Contributing

Feel free to contribute to this project by:
- Reporting bugs
- Suggesting new features
- Improving documentation
- Submitting pull requests

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Note**: This is a demonstration application. For production use, implement proper security measures, error handling, and scalability features. 