import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

export default function App() {
  const [agentResponse, setAgentResponse] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [kitchenOrders, setKitchenOrders] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    socket.on("AGENT_RESPONSE", (res) => {
      setAgentResponse(res);
      setIsProcessing(false);
    });
    socket.on("KITCHEN_ORDER_RECEIVED", (newOrder) =>
      setKitchenOrders((prev) => [...prev, newOrder]),
    );

    socket.on("ORDER_COMPLETED", (orderId) => {
      setKitchenOrders((prev) => prev.filter((order) => order._id !== orderId));
    });

    return () => {
      socket.off("AGENT_RESPONSE");
      socket.off("KITCHEN_ORDER_RECEIVED");
      socket.off("ORDER_COMPLETED");
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = sendAudioToServer;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert(
        "Microphone access denied. Please allow microphone permissions in your browser.",
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }
  };

  const sendAudioToServer = async () => {
    setIsProcessing(true);
    setAgentResponse(null);
    setCustomerEmail("");

    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    audioChunksRef.current = [];

    const formData = new FormData();
    formData.append("audio", audioBlob, "drivethru-order.webm");

    try {
      const res = await fetch("http://localhost:5000/upload-audio", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setAgentResponse(data);
    } catch (err) {
      console.error("Upload failed", err);
      alert("There was a problem sending your order. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmOrder = () => {
    if (agentResponse?.type === "ORDER_CONFIRMATION_NEEDED") {
      const payloadWithEmail = { ...agentResponse.payload, customerEmail };
      socket.emit("CONFIRM_ORDER", payloadWithEmail);
      setAgentResponse(null);
      setCustomerEmail("");
    }
  };

  const handleTaskComplete = (orderId) => {
    socket.emit("KITCHEN_TASK_COMPLETE", orderId);
  };

  return (
    <div className="app-wrapper">
      <style>{`
        body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; }
        .app-wrapper { padding: 20px; max-width: 1200px; margin: 0 auto; }
        
        .main-header { text-align: center; margin-bottom: 40px; }
        .main-header h1 { font-size: 3rem; color: #1e3a8a; margin: 0; letter-spacing: -1px; }
        .main-header p { font-size: 1.2rem; color: #475569; margin-top: 5px; }

        .grid-container { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        @media (max-width: 900px) { .grid-container { grid-template-columns: 1fr; } }

        .panel { background: white; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; overflow: hidden; display: flex; flex-direction: column; }
        
        .panel-header-blue { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .panel-header-blue h2 { margin: 0; font-size: 2rem; }
        .panel-header-orange { background: #ea580c; color: white; padding: 20px; text-align: center; }
        .panel-header-orange h2 { margin: 0; font-size: 2rem; }
        
        .panel-body { padding: 30px; flex-grow: 1; display: flex; flex-direction: column; }

        .instruction-box { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 15px; padding: 20px; text-align: center; margin-bottom: 30px; }
        .instruction-box h3 { color: #1e3a8a; font-size: 1.5rem; margin-top: 0; }
        .instruction-box p { font-size: 1.1rem; color: #334155; line-height: 1.5; }

        .mic-btn { width: 100%; padding: 20px; font-size: 1.3rem; font-weight: bold; border-radius: 12px; cursor: pointer; transition: all 0.2s; border: none; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .mic-btn.idle { background: #16a34a; color: white; }
        .mic-btn.idle:hover { background: #15803d; transform: translateY(-2px); }
        .mic-btn.recording { background: #ef4444; color: white; animation: pulse 1.5s infinite; transform: scale(1.02); }
        .mic-btn:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }

        .output-box { background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 15px; padding: 25px; min-height: 300px; display: flex; flex-direction: column; }
        .output-title { font-size: 1.4rem; color: #1e293b; border-bottom: 2px solid #cbd5e1; padding-bottom: 10px; margin-top: 0; margin-bottom: 20px; }

        .item-card { background: white; padding: 15px; border-radius: 10px; border-left: 5px solid #3b82f6; margin-bottom: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .item-row { display: flex; justify-content: space-between; align-items: center; }
        .item-name { font-size: 1.2rem; font-weight: bold; color: #1e293b; }
        .item-price { font-size: 1.2rem; font-weight: bold; color: #15803d; }
        .qty-badge { background: #dbeafe; color: #1e40af; padding: 3px 8px; border-radius: 5px; font-weight: bold; margin-right: 10px; }
        .mod-text { color: #dc2626; font-size: 0.9rem; font-weight: bold; margin-top: 5px; margin-left: 45px; }

        .total-row { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: white; padding: 15px 20px; border-radius: 10px; margin-top: 20px; margin-bottom: 20px; }
        .total-label { font-size: 1.2rem; font-weight: bold; }
        .total-price { font-size: 1.5rem; font-weight: bold; color: #4ade80; }

        .input-label { display: block; font-weight: bold; color: #334155; margin-bottom: 8px; font-size: 1.1rem; }
        .email-input { width: 100%; padding: 15px; border-radius: 10px; border: 2px solid #cbd5e1; font-size: 1.1rem; box-sizing: border-box; margin-bottom: 20px; transition: border-color 0.2s; }
        .email-input:focus { outline: none; border-color: #3b82f6; }

        .btn-group { display: flex; gap: 15px; margin-top: auto; }
        .btn-group button { flex: 1; padding: 15px; font-size: 1.2rem; font-weight: bold; border-radius: 10px; cursor: pointer; border: none; transition: 0.2s; }
        .btn-cancel { background: #fee2e2; color: #b91c1c; }
        .btn-cancel:hover { background: #fca5a5; }
        .btn-confirm { background: #16a34a; color: white; box-shadow: 0 4px 6px rgba(22, 163, 74, 0.3); }
        .btn-confirm:hover { background: #15803d; transform: translateY(-2px); }

        .kitchen-empty { text-align: center; color: #f97316; padding: 50px 20px; border: 3px dashed #fed7aa; border-radius: 15px; font-size: 1.2rem; background: #fffaf5; }
        .kitchen-order { background: white; border-radius: 15px; border: 1px solid #e2e8f0; border-left: 8px solid #f97316; margin-bottom: 20px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .kitchen-order-header { background: #f1f5f9; padding: 15px 20px; display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155; }
        .kitchen-order-body { padding: 20px; }
        .kitchen-item { background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 10px; }
        
        .btn-complete { width: 100%; padding: 15px; font-size: 1.2rem; font-weight: bold; background: #f0fdf4; color: #15803d; border: 2px solid #22c55e; border-radius: 10px; cursor: pointer; margin-top: 15px; transition: 0.2s; }
        .btn-complete:hover { background: #22c55e; color: white; }

        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
      `}</style>

      <div className="main-header">
        <h1>Agentic Eats</h1>
        <p>Smart Drive-Thru & Kitchen Assistant</p>
      </div>

      <div className="grid-container">
        {/* CUSTOMER DRIVE-THRU PANEL */}
        <div className="panel">
          <div className="panel-header-blue">
            <h2>🎙️ Drive-Thru Screen</h2>
            <div style={{ opacity: 0.8, fontSize: "1.1rem", marginTop: "5px" }}>
              For the Customer
            </div>
          </div>

          <div className="panel-body">
            <div className="instruction-box">
              <h3>Step 1: Place Your Order</h3>
              <p>
                Click and hold the big green button below, speak your order
                naturally, and let go when you are done.
                <br />
                <span style={{ fontStyle: "italic", color: "#64748b" }}>
                  (e.g., "I'd like a double burger with no cheese and some
                  fries.")
                </span>
              </p>

              <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onMouseLeave={stopRecording}
                disabled={isProcessing}
                className={`mic-btn ${isRecording ? "recording" : "idle"}`}
              >
                {isRecording
                  ? "🔴 RECORDING... LET GO TO SEND"
                  : isProcessing
                    ? "⏳ THINKING..."
                    : "🎙️ HOLD THIS BUTTON TO SPEAK"}
              </button>
            </div>

            <div className="output-box">
              <h3 className="output-title">Step 2: Review Output</h3>

              {!agentResponse && !isProcessing && (
                <div
                  style={{
                    textAlign: "center",
                    color: "#94a3b8",
                    fontStyle: "italic",
                    marginTop: "50px",
                    fontSize: "1.2rem",
                  }}
                >
                  Your order summary will appear here.
                </div>
              )}

              {/* INQUIRY RESULT */}
              {agentResponse?.type === "INQUIRY_RESULT" && (
                <div>
                  <p
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: "bold",
                      color: "#334155",
                      marginBottom: "15px",
                    }}
                  >
                    Here is what we found on the menu:
                  </p>
                  {agentResponse.suggestions.map((item, i) => (
                    <div className="item-card" key={i}>
                      <div className="item-row">
                        <span className="item-name">{item.name}</span>
                        <span className="item-price">${item.price}</span>
                      </div>
                      <p style={{ color: "#64748b", margin: "5px 0 0 0" }}>
                        {item.description}
                      </p>
                    </div>
                  ))}
                  <button
                    className="btn-cancel"
                    style={{ width: "100%", marginTop: "20px" }}
                    onClick={() => setAgentResponse(null)}
                  >
                    Clear Screen
                  </button>
                </div>
              )}

              {/* ORDER RESULT */}
              {agentResponse?.type === "ORDER_CONFIRMATION_NEEDED" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                  }}
                >
                  <div
                    style={{
                      background: "#fefce8",
                      border: "2px solid #fef08a",
                      padding: "15px",
                      borderRadius: "10px",
                      color: "#854d0e",
                      fontWeight: "bold",
                      textAlign: "center",
                      marginBottom: "20px",
                    }}
                  >
                    Please make sure your order looks correct!
                  </div>

                  <div style={{ flexGrow: 1 }}>
                    {agentResponse.payload.items.map((item, idx) => (
                      <div
                        className="item-card"
                        style={{ borderLeftColor: "#16a34a" }}
                        key={idx}
                      >
                        <div className="item-row">
                          <div>
                            <span className="qty-badge">{item.quantity}x</span>
                            <span className="item-name">{item.name}</span>
                          </div>
                          <span className="item-price">
                            ${item.line_total.toFixed(2)}
                          </span>
                        </div>
                        {item.special_instructions &&
                          item.special_instructions !== "none" && (
                            <div className="mod-text">
                              ❌ Mod: {item.special_instructions}
                            </div>
                          )}
                      </div>
                    ))}

                    <div className="total-row">
                      <span className="total-label">Total Due:</span>
                      <span className="total-price">
                        ${agentResponse.payload.total_price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div style={{ marginBottom: "20px" }}>
                    <label className="input-label">
                      Would you like an email receipt? (Optional)
                    </label>
                    <input
                      type="email"
                      className="email-input"
                      placeholder="Enter your email address here..."
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                    />
                    <div style={{ color: "#64748b", fontSize: "0.9rem" }}>
                      We will email you a summary when your food is ready.
                    </div>
                  </div>

                  <div className="btn-group">
                    <button
                      className="btn-cancel"
                      onClick={() => setAgentResponse(null)}
                    >
                      Cancel Order
                    </button>
                    <button
                      className="btn-confirm"
                      onClick={handleConfirmOrder}
                    >
                      Looks Good! Order
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KITCHEN QUEUE PANEL */}
        <div className="panel">
          <div className="panel-header-orange">
            <h2>👨‍🍳 Kitchen Queue</h2>
            <div style={{ opacity: 0.8, fontSize: "1.1rem", marginTop: "5px" }}>
              For the Chefs & Staff
            </div>
          </div>

          <div className="panel-body" style={{ background: "#fff7ed" }}>
            <p
              style={{
                textAlign: "center",
                color: "#475569",
                fontSize: "1.1rem",
                marginBottom: "30px",
                borderBottom: "2px solid #ffedd5",
                paddingBottom: "20px",
              }}
            >
              Confirmed orders will appear here automatically. When you have
              finished preparing the food, click the green button to clear it
              from your screen and notify the customer.
            </p>

            {kitchenOrders.length === 0 ? (
              <div className="kitchen-empty">
                <div style={{ fontSize: "4rem", marginBottom: "10px" }}>🍽️</div>
                <strong>No Orders Pending</strong>
                <br />
                Waiting for customers...
              </div>
            ) : (
              <div>
                {kitchenOrders.map((order, idx) => (
                  <div className="kitchen-order" key={idx}>
                    <div className="kitchen-order-header">
                      <span>Order #{order._id?.slice(-4) || idx}</span>
                      <span>
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="kitchen-order-body">
                      {order.items.map((item, i) => (
                        <div className="kitchen-item" key={i}>
                          <span
                            style={{
                              background: "#ffedd5",
                              color: "#c2410c",
                              fontWeight: "bold",
                              padding: "3px 8px",
                              borderRadius: "5px",
                              marginRight: "10px",
                            }}
                          >
                            {item.quantity}x
                          </span>
                          <span
                            style={{ fontWeight: "bold", fontSize: "1.1rem" }}
                          >
                            {item.name}
                          </span>

                          {item.special_instructions &&
                            item.special_instructions !== "none" && (
                              <div
                                style={{
                                  color: "#dc2626",
                                  fontWeight: "bold",
                                  fontSize: "0.9rem",
                                  marginTop: "5px",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                              >
                                <span
                                  style={{
                                    background: "#fee2e2",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    marginRight: "8px",
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  MODIFICATION
                                </span>
                                {item.special_instructions}
                              </div>
                            )}
                        </div>
                      ))}

                      <button
                        className="btn-complete"
                        onClick={() => handleTaskComplete(order._id)}
                      >
                        ✅ Mark Order as Prepared
                      </button>
                      {order.customerEmail && (
                        <div
                          style={{
                            textAlign: "center",
                            color: "#64748b",
                            fontSize: "0.9rem",
                            marginTop: "10px",
                            fontStyle: "italic",
                          }}
                        >
                          An email receipt will be sent automatically.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
