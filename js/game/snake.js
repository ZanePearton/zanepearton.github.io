// Fixed Snake.js with Visible Trail

var state = {
  xPos: 10,
  yPos: 10,
  gameSize: 20,
  xAccel: 15,
  yAccel: 15,
  xVel: 0,
  yVel: -1, // Start moving up
  trail: [],
  setTail: 1, // Start with just the head
  tail: 1,
  score: 0,
  highScore: 0,
  speedDifficulty: 300, // Even slower to see what's happening
  moveRecord: [],
  currGen: 0,
  gameRunning: false, // Start paused
  direction: ['left', 'forward', 'right'],
  xApple: Math.floor(Math.random()*20),
  yApple: Math.floor(Math.random()*20),
  loopsSinceApple: 0
}

let canv, ctx, gameSpeed;
let model = null;
let trainingData = [];
let targetData = [];
let isTraining = false;

// TensorFlow.js Model Initialization
async function initializeModel() {
    console.log('Initializing TensorFlow.js model...');
    
    try {
        model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [5],
                    units: 16,
                    activation: 'relu',
                    kernelInitializer: 'randomUniform'
                }),
                tf.layers.dense({
                    units: 12,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 8,
                    activation: 'relu'
                }),
                tf.layers.dense({
                    units: 3,
                    activation: 'softmax'
                })
            ]
        });

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        console.log('TensorFlow.js model initialized successfully');
        updateTrainingProgress('Model initialized');
        
    } catch (error) {
        console.error('Error initializing model:', error);
    }
}

// Neural Network Prediction with better decision making
async function makePrediction(inputs) {
    if (!model || isTraining) {
        // Smarter fallback - avoid immediate collisions
        const obstacles = inputs.slice(0, 3);
        const availableActions = [];
        
        if (obstacles[0] === 0) availableActions.push(0); // left
        if (obstacles[1] === 0) availableActions.push(1); // forward  
        if (obstacles[2] === 0) availableActions.push(2); // right
        
        if (availableActions.length > 0) {
            return state.direction[availableActions[Math.floor(Math.random() * availableActions.length)]];
        }
        
        return state.direction[1]; // Default to forward
    }

    try {
        const normalizedInputs = [
            inputs[0], // obstacle left (0 or 1)
            inputs[1], // obstacle forward (0 or 1) 
            inputs[2], // obstacle right (0 or 1)
            inputs[3] / 2 + 0.5, // apple x direction (-1 to 1 -> 0 to 1)
            inputs[4] / 2 + 0.5  // apple y direction (-1 to 1 -> 0 to 1)
        ];

        const inputTensor = tf.tensor2d([normalizedInputs], [1, 5]);
        const prediction = model.predict(inputTensor);
        const probabilities = await prediction.data();
        
        inputTensor.dispose();
        prediction.dispose();
        
        // Find best action that doesn't lead to immediate collision
        const sortedActions = Array.from({length: 3}, (_, i) => i)
            .map(i => ({action: i, prob: probabilities[i]}))
            .sort((a, b) => b.prob - a.prob);
        
        // Choose highest probability action that's safe
        for (let {action} of sortedActions) {
            if (inputs[action] === 0) { // No obstacle
                visualizeNeuralNetwork(normalizedInputs, probabilities, action);
                return state.direction[action];
            }
        }
        
        // If all actions lead to collision, choose the one with highest probability
        const maxIndex = probabilities.indexOf(Math.max(...probabilities));
        visualizeNeuralNetwork(normalizedInputs, probabilities, maxIndex);
        return state.direction[maxIndex];
        
    } catch (error) {
        console.error('Prediction error:', error);
        return state.direction[1]; // Default to forward
    }
}

// Model Training
async function fitModel(moveRecord) {
    if (!model || moveRecord.length < 20 || isTraining) {
        console.log('Not enough data to train, model not ready, or already training');
        return;
    }

    isTraining = true;
    updateTrainingProgress('Training in progress...');
    console.log('Training model with', moveRecord.length, 'moves');

    try {
        const inputs = [];
        const targets = [];

        for (let i = 0; i < moveRecord.length - 1; i++) {
            const currentState = moveRecord[i];
            if (currentState.length !== 5) continue;
            
            const expectedAction = getExpected(currentState);
            
            const normalizedInputs = [
                currentState[0],
                currentState[1],
                currentState[2],
                currentState[3] / 2 + 0.5,
                currentState[4] / 2 + 0.5
            ];
            
            const target = [0, 0, 0];
            if (expectedAction >= 0 && expectedAction < 3) {
                target[expectedAction] = 1;
            } else {
                target[1] = 1;
            }
            
            inputs.push(normalizedInputs);
            targets.push(target);
        }

        if (inputs.length === 0) {
            isTraining = false;
            return;
        }

        const inputTensor = tf.tensor2d(inputs);
        const targetTensor = tf.tensor2d(targets);

        const history = await model.fit(inputTensor, targetTensor, {
            epochs: 20,
            batchSize: Math.min(32, inputs.length),
            shuffle: true,
            verbose: 0,
            validationSplit: 0.1
        });

        const finalLoss = history.history.loss[history.history.loss.length - 1];
        console.log('Training completed. Loss:', finalLoss);
        updateTrainingProgress(`Training complete - Loss: ${finalLoss.toFixed(4)}`);

        inputTensor.dispose();
        targetTensor.dispose();

    } catch (error) {
        console.error('Training error:', error);
        updateTrainingProgress('Training error occurred');
    } finally {
        isTraining = false;
    }
}

// Visualize Neural Network Activity
function visualizeNeuralNetwork(inputs, probabilities, prediction) {
    const inputIds = ['input-1', 'input-2', 'input-3', 'input-4'];
    for (let i = 0; i < Math.min(inputs.length - 1, inputIds.length); i++) {
        const node = document.getElementById(inputIds[i]);
        if (node) {
            const intensity = inputs[i];
            node.style.backgroundColor = `rgba(0, 255, 0, ${intensity * 0.8 + 0.2})`;
            node.style.transform = `scale(${1 + intensity * 0.3})`;
        }
    }
    
    const outputIds = ['output-1', 'output-2', 'output-3'];
    for (let i = 0; i < outputIds.length; i++) {
        const node = document.getElementById(outputIds[i]);
        if (node && probabilities) {
            const intensity = probabilities[i];
            const isSelected = i === prediction;
            node.style.backgroundColor = isSelected ? 
                `rgba(255, 100, 100, ${intensity * 0.8 + 0.4})` : 
                `rgba(100, 100, 255, ${intensity * 0.6 + 0.2})`;
            node.style.transform = `scale(${1 + intensity * 0.4})`;
        }
    }
    
    const hiddenIds = ['hidden-1', 'hidden-2', 'hidden-3'];
    hiddenIds.forEach(id => {
        const node = document.getElementById(id);
        if (node) {
            const activity = Math.random() * 0.6 + 0.2;
            node.style.backgroundColor = `rgba(255, 255, 0, ${activity})`;
            node.style.transform = `scale(${1 + activity * 0.2})`;
        }
    });
}

function updateTrainingProgress(message) {
    const progressElement = document.getElementById('training-progress');
    if (progressElement) {
        progressElement.textContent = message;
    }
}

function cleanupMemory() {
    if (state.currGen % 30 === 0) {
        console.log('Cleaning up GPU memory...');
        const numTensors = tf.memory().numTensors;
        console.log('Tensors before cleanup:', numTensors);
        
        if (typeof window !== 'undefined' && window.gc) {
            window.gc();
        }
        
        console.log('Memory info:', tf.memory());
    }
}

// Window Load Event
window.onload = async function() {
    canv = document.getElementById("canvas");
    if (!canv) {
        console.error("Canvas with id 'canvas' not found!");
        return;
    }
    ctx = canv.getContext("2d");
    if (!ctx) {
        console.error("Could not get 2D context from canvas!");
        return;
    }
    
    // Initialize snake position and trail
    state.trail = [{x: state.xPos, y: state.yPos}];
    
    document.addEventListener("keydown", handleManualKeyboard);
    
    await initializeModel();
    setupUIControls();
    
    // Draw initial state
    drawGame();
    
    console.log('Game initialized. Press Start Training to begin.');
}

// Handle manual keyboard input for testing
function handleManualKeyboard(evt) {
    if (!state.gameRunning) return;
    
    switch(evt.keyCode) {
        case 37: // Left arrow
            keyPush('left');
            break;
        case 38: // Up arrow  
            keyPush('forward');
            break;
        case 39: // Right arrow
            keyPush('right');
            break;
    }
}

function setupUIControls() {
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    if (speedSlider && speedValue) {
        speedSlider.addEventListener('input', (e) => {
            const newSpeed = parseInt(e.target.value);
            speedValue.textContent = newSpeed;
            
            clearInterval(gameSpeed);
            state.speedDifficulty = Math.max(50, 300 - (newSpeed * 25));
            if (state.gameRunning) {
                gameSpeed = setInterval(game, state.speedDifficulty);
            }
        });
    }
    
    const populationSlider = document.getElementById('populationSlider');
    const populationValue = document.getElementById('populationValue');
    if (populationSlider && populationValue) {
        populationSlider.addEventListener('input', (e) => {
            populationValue.textContent = e.target.value;
        });
    }
    
    const startBtn = document.getElementById('start-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const resetBtn = document.getElementById('reset-btn');
    
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (!state.gameRunning) {
                state.gameRunning = true;
                startBtn.textContent = 'Running';
                gameSpeed = setInterval(game, state.speedDifficulty);
                console.log('Game started');
            }
        });
    }
    
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            state.gameRunning = !state.gameRunning;
            pauseBtn.textContent = state.gameRunning ? 'Pause' : 'Resume';
            
            if (state.gameRunning) {
                gameSpeed = setInterval(game, state.speedDifficulty);
            } else {
                clearInterval(gameSpeed);
            }
        });
    }
    
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            clearInterval(gameSpeed);
            resetGame();
            drawGame();
        });
    }
}

// Fixed Main Game Loop
function game() {
    if (!state.gameRunning) return;
    
    // Move snake
    state.xPos += state.xVel;
    state.yPos += state.yVel;

    // Add current position to trail
    state.trail.push({ x: state.xPos, y: state.yPos });
    
    // Remove excess trail segments
    while (state.trail.length > state.tail) {
        state.trail.shift();
    }

    // Check wall collisions
    if (state.xPos < 0 || state.xPos >= state.gameSize || state.yPos < 0 || state.yPos >= state.gameSize) {
        console.log('Wall collision');
        resetGame();
        return;
    }

    // Check self collision (only if trail has more than 1 segment)
    if (state.trail.length > 1) {
        for (let i = 0; i < state.trail.length - 1; i++) {
            if (state.trail[i].x === state.xPos && state.trail[i].y === state.yPos) {
                console.log('Self collision at position:', state.xPos, state.yPos);
                resetGame();
                return;
            }
        }
    }

    // Check apple collision
    if (state.xApple === state.xPos && state.yApple === state.yPos) {
        state.loopsSinceApple = 0;
        state.tail++;
        state.score += 5;
        
        // Place new apple
        do {
            state.xApple = Math.floor(Math.random() * state.gameSize);
            state.yApple = Math.floor(Math.random() * state.gameSize);
        } while (state.trail.some(segment => segment.x === state.xApple && segment.y === state.yApple));
        
        console.log('Apple eaten! Score:', state.score);
    }

    // Check if stuck (too long without apple)
    if (state.loopsSinceApple >= 200) {
        console.log('Stuck - resetting');
        resetGame();
        return;
    }

    // Record move for training
    state.moveRecord.push(getPosArr());
    
    // Get AI prediction (add some delay for decisions)
    if (state.moveRecord.length % 3 === 0) { // Make decisions every 3 moves to reduce erratic behavior
        makePrediction(getPosArr()).then(prediction => {
            keyPush(prediction);
        });
    }

    // Draw everything
    drawGame();
    
    // Update UI
    updateUI();
    
    state.loopsSinceApple++;
}

// Fixed Drawing Function
function drawGame() {
    // Clear canvas with white background
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, canv.width, canv.height);
    
    // Draw grid lines (optional - helps see the game better)
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= state.gameSize; i++) {
        ctx.beginPath();
        ctx.moveTo(i * (canv.width / state.gameSize), 0);
        ctx.lineTo(i * (canv.width / state.gameSize), canv.height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i * (canv.height / state.gameSize));
        ctx.lineTo(canv.width, i * (canv.height / state.gameSize));
        ctx.stroke();
    }
    
    // Calculate cell size
    const cellWidth = canv.width / state.gameSize;
    const cellHeight = canv.height / state.gameSize;
    
    // Draw snake trail
    ctx.fillStyle = "#2d5a27"; // Dark green for body
    for (let i = 0; i < state.trail.length - 1; i++) {
        const segment = state.trail[i];
        ctx.fillRect(
            segment.x * cellWidth + 1, 
            segment.y * cellHeight + 1, 
            cellWidth - 2, 
            cellHeight - 2
        );
    }
    
    // Draw snake head (different color)
    if (state.trail.length > 0) {
        ctx.fillStyle = "#4CAF50"; // Bright green for head
        const head = state.trail[state.trail.length - 1];
        ctx.fillRect(
            head.x * cellWidth + 1, 
            head.y * cellHeight + 1, 
            cellWidth - 2, 
            cellHeight - 2
        );
    }
    
    // Draw apple
    ctx.fillStyle = "#FF5722"; // Red-orange for apple
    ctx.fillRect(
        state.xApple * cellWidth + 2, 
        state.yApple * cellHeight + 2, 
        cellWidth - 4, 
        cellHeight - 4
    );
    
    // Add apple shine effect
    ctx.fillStyle = "#FFE0B2";
    ctx.fillRect(
        state.xApple * cellWidth + 3, 
        state.yApple * cellHeight + 3, 
        cellWidth - 10, 
        cellHeight - 10
    );
}

function updateUI() {
    const scoreElement = document.getElementById("current-score");
    const genElement = document.getElementById("generation");
    const highScoreElement = document.getElementById("high-score");
    const lengthElement = document.getElementById("snake-length");
    
    if (scoreElement) scoreElement.textContent = state.score;
    if (genElement) genElement.textContent = state.currGen;
    if (highScoreElement) highScoreElement.textContent = state.highScore;
    if (lengthElement) lengthElement.textContent = `Snake Length: ${state.tail}`;
}

function keyPush(input) {
    if (input == 'left') {
        if (state.yVel == -1) { // Moving up
            state.xVel = -1;
            state.yVel = 0;
        } else if (state.yVel == 1) { // Moving down
            state.xVel = 1;
            state.yVel = 0;
        } else if (state.xVel == -1) { // Moving left
            state.xVel = 0;
            state.yVel = 1;
        } else { // Moving right
            state.xVel = 0;
            state.yVel = -1;
        }
    } else if (input == 'right') {
        if (state.yVel == -1) { // Moving up
            state.xVel = 1;
            state.yVel = 0;
        } else if (state.yVel == 1) { // Moving down
            state.xVel = -1;
            state.yVel = 0;
        } else if (state.xVel == -1) { // Moving left
            state.xVel = 0;
            state.yVel = -1;
        } else { // Moving right
            state.xVel = 0;
            state.yVel = 1;
        }
    } else if (input == 'forward') {
        if (state.yVel == 0 && state.xVel == 0) {
            state.yVel = -1;
        }
    }
}

function resetGame() {
    clearInterval(gameSpeed);
    state.gameRunning = false;
    
    if (state.score > state.highScore) {
        state.highScore = state.score;
    }
    
    console.log(`Generation ${state.currGen} ended - Score: ${state.score}, Length: ${state.tail}`);
    
    // Reset game state
    state.tail = state.setTail;
    state.score = 0;
    state.xVel = 0;
    state.yVel = -1; // Start moving up again
    state.xPos = Math.floor(state.gameSize / 2); // Center position
    state.yPos = Math.floor(state.gameSize / 2);
    state.trail = [{x: state.xPos, y: state.yPos}];
    state.currGen++;
    
    // Train model
    if (state.moveRecord.length > 0) {
        fitModel(state.moveRecord);
    }
    
    state.loopsSinceApple = 0;
    state.moveRecord = [];
    
    cleanupMemory();
    
    // Reset apple position (make sure it's not on snake)
    do {
        state.xApple = Math.floor(Math.random() * state.gameSize);
        state.yApple = Math.floor(Math.random() * state.gameSize);
    } while (state.xApple === state.xPos && state.yApple === state.yPos);
    
    // Automatically restart after a short delay
    setTimeout(() => {
        if (state.currGen < 1000) { // Auto-restart for first 1000 generations
            state.gameRunning = true;
            gameSpeed = setInterval(game, state.speedDifficulty);
            console.log(`Starting generation ${state.currGen}`);
        }
    }, 100);
    
    console.log('Game reset. Generation:', state.currGen);
}

// Rest of the functions remain the same...
function getPosArr() {
    var arr = [0, 0, 0];
    var relApple = [0, 0];
    
    if (state.yVel == -1) { // Moving up
        if (state.xApple < state.xPos) {
            relApple[0] = -1;
        } else if (state.xApple == state.xPos) {
            relApple[0] = 0;
        } else {
            relApple[0] = 1;
        }

        if (state.yApple < state.yPos) {
            relApple[1] = 1;
        } else if (state.yApple == state.yPos) {
            relApple[1] = 0;
        } else {
            relApple[1] = -1;
        }

        // Check obstacles
        if (state.xPos == 0) arr[0] = 1;
        if (state.yPos == 0) arr[1] = 1;
        if (state.xPos == state.gameSize - 1) arr[2] = 1;
        
        for (var i = 0; i < state.trail.length; i++) {
            if (state.trail[i].x == state.xPos - 1 && state.trail[i].y == state.yPos) arr[0] = 1;
            if (state.trail[i].x == state.xPos && state.trail[i].y == state.yPos - 1) arr[1] = 1;
            if (state.trail[i].x == state.xPos + 1 && state.trail[i].y == state.yPos) arr[2] = 1;
        }
    } else if (state.yVel == 1) { // Moving down
        if (state.xApple < state.xPos) {
            relApple[0] = 1;
        } else if (state.xApple == state.xPos) {
            relApple[0] = 0;
        } else {
            relApple[0] = -1;
        }

        if (state.yApple < state.yPos) {
            relApple[1] = -1;
        } else if (state.yApple == state.yPos) {
            relApple[1] = 0;
        } else {
            relApple[1] = 1;
        }

        if (state.xPos == state.gameSize - 1) arr[0] = 1;
        if (state.yPos == state.gameSize - 1) arr[1] = 1;
        if (state.xPos == 0) arr[2] = 1;
        
        for (var i = 0; i < state.trail.length; i++) {
            if (state.trail[i].x == state.xPos + 1 && state.trail[i].y == state.yPos) arr[0] = 1;
            if (state.trail[i].x == state.xPos && state.trail[i].y == state.yPos + 1) arr[1] = 1;
            if (state.trail[i].x == state.xPos - 1 && state.trail[i].y == state.yPos) arr[2] = 1;
        }
    } else if (state.xVel == -1) { // Moving left
        if (state.xApple < state.xPos) {
            relApple[1] = -1;
        } else if (state.xApple == state.xPos) {
            relApple[1] = 0;
        } else {
            relApple[1] = 1;
        }

        if (state.yApple < state.yPos) {
            relApple[0] = 1;
        } else if (state.yApple == state.yPos) {
            relApple[0] = 0;
        } else {
            relApple[0] = -1;
        }

        if (state.yPos == state.gameSize - 1) arr[0] = 1;
        if (state.xPos == 0) arr[1] = 1;
        if (state.yPos == 0) arr[2] = 1;
        
        for (var i = 0; i < state.trail.length; i++) {
            if (state.trail[i].x == state.xPos && state.trail[i].y == state.yPos + 1) arr[0] = 1;
            if (state.trail[i].x == state.xPos - 1 && state.trail[i].y == state.yPos) arr[1] = 1;
            if (state.trail[i].x == state.xPos && state.trail[i].y == state.yPos - 1) arr[2] = 1;
        }
    } else if (state.xVel == 1) { // Moving right
        if (state.xApple < state.xPos) {
            relApple[1] = 1;
        } else if (state.xApple == state.xPos) {
            relApple[1] = 0;
        } else {
            relApple[1] = -1;
        }

        if (state.yApple < state.yPos) {
            relApple[0] = -1;
        } else if (state.yApple == state.yPos) {
            relApple[0] = 0;
        } else {
            relApple[0] = 1;
        }

        if (state.yPos == 0) arr[0] = 1;
        if (state.xPos == state.gameSize - 1) arr[1] = 1;
        if (state.yPos == state.gameSize - 1) arr[2] = 1;

        for (var i = 0; i < state.trail.length; i++) {
            if (state.trail[i].x == state.xPos && state.trail[i].y == state.yPos - 1) arr[0] = 1;
            if (state.trail[i].x == state.xPos + 1 && state.trail[i].y == state.yPos) arr[1] = 1;
            if (state.trail[i].x == state.xPos && state.trail[i].y == state.yPos + 1) arr[2] = 1;
        }
    } else {
        if (state.xApple < state.xPos) {
            relApple[0] = -1;
        } else if (state.xApple == state.xPos) {
            relApple[0] = 0;
        } else {
            relApple[0] = 1;
        }

        if (state.yApple < state.yPos) {
            relApple[1] = -1;
        } else if (state.yApple == state.yPos) {
            relApple[1] = 0;
        } else {
            relApple[1] = 1;
        }
    }

    arr.push(relApple[0]);
    arr.push(relApple[1]);
    return arr;
}

function getExpected(arr) {
    if (arr[0] == 1 && arr[1] == 1) {
        return 2;
    } else if (arr[0] == 1 && arr[2] == 1) {
        return 1;
    } else if (arr[1] == 1 && arr[2] == 1) {
        return 0;
    } else if (arr[0] == 1 && (arr[3] == -1 || arr[3] == 0)) {
        if (arr[4] == -1) {
            return 2;
        } else {
            return 1;
        }
    } else if (arr[0] == 1 && arr[3] == 1) {
        return 2;
    } else if (arr[1] == 1 && (arr[3] == -1 || arr[3] == 0)) {
        return 0;
    } else if (arr[1] == 1 && arr[3] == 1) {
        return 2;
    } else if (arr[2] == 1 && arr[3] == -1) {
        return 0;
    } else if (arr[2] == 1 && arr[3] == 0) {
        if (arr[4] == -1) {
            return 0;
        } else {
            return 1;
        }
    } else if (arr[2] == 1 && arr[3] == 1) {
        return 1;
    } else if (arr[3] == -1) {
        return 0;
    } else if (arr[3] == 0) {
        if (arr[4] == -1) {
            return 0;
        } else {
            return 1;
        }
    } else {
        return 2;
    }
}

async function saveModel() {
    if (model) {
        try {
            await model.save('downloads://neuro-snake-model');
            console.log('Model saved successfully');
            updateTrainingProgress('Model saved to downloads');
        } catch (error) {
            console.error('Error saving model:', error);
        }
    }
}

async function loadModel(files) {
    try {
        model = await tf.loadLayersModel(tf.io.browserFiles(files));
        console.log('Model loaded successfully');
        updateTrainingProgress('Model loaded successfully');
    } catch (error) {
        console.error('Error loading model:', error);
        updateTrainingProgress('Error loading model');
    }
}