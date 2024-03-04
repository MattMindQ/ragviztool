// Constants and Globals
const TEXT_INPUT_FORM_ID = 'text-input-form';
const TEXT_INPUT_ID = 'text-input';
const CHATBOT_QUERY_FORM_ID = 'chatbot-query-form';
const CHATBOT_QUERY_ID = 'chatbot-query';
const WORD_LIST_ID = 'word-list';
const VISUALIZATION_CONTAINER_ID = 'visualization-container';
const ERROR_CONTAINER_ID = 'error-container';
const FILE_INPUT_ID = 'file-input';
let words = [];
let centralQuery = '';

// Utility Functions
function fetchJSON(url, options) {
    return fetch(url, options).then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    });
}

function displayError(message) {
    const errorContainer = document.getElementById(ERROR_CONTAINER_ID);
    if (errorContainer) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        setTimeout(() => errorContainer.style.display = 'none', 3000);
    } else {
        console.error("Error container not found on the page.");
    }
}

// Text Input Handling
function submitText(event) {
    event.preventDefault();
    const textInput = document.getElementById(TEXT_INPUT_ID);
    const text = textInput.value.trim();

    if (text) {
        textInput.value = '';
        addWordToList(text);
    } else {
        displayError("Please enter a job title or experience.");
    }
}

function addWordToList(word, similarity = null) {
    const list = document.getElementById(WORD_LIST_ID);
    const listItem = document.createElement('li');
    listItem.textContent = `${word}${similarity !== null ? ` (Similarity: ${similarity.toFixed(2)})` : ''}`;
    listItem.className = 'word-item';
    // Delete button for each word
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'delete-btn';
    deleteBtn.onclick = () => deleteWord(word, listItem);
    listItem.appendChild(deleteBtn);
    list.appendChild(listItem);
    words.push(word);
}

function deleteWord(word, listItem) {
    words = words.filter(w => w !== word);
    listItem.remove();
    checkForVisualization();
}

// Check for Visualization
function checkForVisualization() {
    if (words.length >= 3 && centralQuery) {
        document.getElementById(VISUALIZATION_CONTAINER_ID).style.display = 'block';
        fetchVisualizationData();
    } else if (!centralQuery) {
        displayError("Set a central query to see the visualization.");
    } else {
        displayError("Add more words to see the visualization (minimum 3 required).");
        document.getElementById(VISUALIZATION_CONTAINER_ID).style.display = 'none';
    }
}


function fetchVisualizationData() {
    fetchJSON('/get_embeddings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ words: words, centralWord: centralQuery }) // Include centralQuery
    })
    .then(data => {
        if (!data.error) {
            plotData(data);
            updateWordList(data); // Update the word list with similarity data
        } else {
            displayError(data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        displayError("Failed to load visualization.");
    });
}
function updateWordList(data) {
    // Clear existing list
    const list = document.getElementById(WORD_LIST_ID);
    list.innerHTML = '';

    // Sort data by similarity in descending order
    data.sort((a, b) => b.similarity - a.similarity);

    // Create and append list items
    data.forEach(item => {
        addWordToList(item.word, item.similarity);
    });
}

function plotData(data) {
    let traces = [];
    const clusters = new Map();

    // Group data by clusters
    data.forEach(point => {
        if (!clusters.has(point.cluster)) {
            clusters.set(point.cluster, []);
        }
        clusters.get(point.cluster).push(point);
    });

    // Create a trace for each cluster with a unique color
    clusters.forEach((points, clusterId) => {
        const trace = {
            x: points.map(p => p.coordinates[0]),
            y: points.map(p => p.coordinates[1]),
            z: points.map(p => p.coordinates[2]),
            mode: 'markers+text',
            text: points.map(p => p.word),
            type: 'scatter3d',
            name: `Cluster ${clusterId}`,
            marker: {
                color: getColorForCluster(clusterId),
                size: 12,
                line: {
                    color: 'rgba(217, 217, 217, 0.14)',
                    width: 0.5
                },
                opacity: 0.8
            }
        };
        traces.push(trace);
    });

    const layout = {
        title: 'Semantic Clusters of Words',
        scene: {
            xaxis: { title: 'PCA Dimension 1' },
            yaxis: { title: 'PCA Dimension 2' },
            zaxis: { title: 'PCA Dimension 3' },
            aspectratio: { x: 1, y: 1, z: 1 },
            camera: {
                eye: { x: 1.5, y: 1.5, z: 1.5 } // Adjust for better perspective
            }
        },
        margin: { l: 0, r: 0, b: 0, t: 30 }, // Adjust margins to fit your layout
        legend: {
            title: { text: 'Clusters' },
            font: { size: 12 },
            yanchor: 'top',
            xanchor: 'right',
            orientation: 'v'
        }
    };    

    Plotly.newPlot('myDiv', traces, layout);
}

function getColorForCluster(clusterId) {
    // Define a method to get a unique color for each cluster
    const colors = ['red', 'green', 'blue', 'yellow', 'purple', 'orange', 'brown', 'pink', 'grey', 'cyan']; // Example color array
    return colors[clusterId % colors.length];
}



// File Upload Handling
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = JSON.parse(e.target.result);
                processUploadedData(data);
            } catch (error) {
                console.error('Error parsing JSON:', error);
                displayError('Invalid JSON file.');
            }
        };
        reader.readAsText(file);
    }
}

function processUploadedData(data) {
    if (data && data.jobs && Array.isArray(data.jobs)) {
        // Clear existing words
        words = [];
        document.getElementById(WORD_LIST_ID).innerHTML = '';
        data.jobs.forEach(addWordToList);
        checkForVisualization();
    } else {
        displayError('Invalid JSON format. Expected an array of jobs.');
    }
}

// Handling Chatbot Query
function submitChatbotQuery(event) {
    event.preventDefault();
    const chatbotQueryInput = document.getElementById(CHATBOT_QUERY_ID);
    centralQuery = chatbotQueryInput.value.trim();

    if (centralQuery) {
        document.getElementById('central-text').textContent = `Central Query: ${centralQuery}`;
        checkForVisualization();
    } else {
        displayError("Please enter a chatbot query.");
    }
}

// Event Listeners
document.getElementById(TEXT_INPUT_FORM_ID).addEventListener('submit', submitText);
document.getElementById(CHATBOT_QUERY_FORM_ID).addEventListener('submit', submitChatbotQuery);
document.getElementById(FILE_INPUT_ID).addEventListener('change', handleFileUpload);

const dropArea = document.getElementById('drop-area');

// Prevent default drag behaviors
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

// Highlight drop area when item is dragged over it
['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, unhighlight, false);
});

function highlight(e) {
  dropArea.classList.add('highlight');
}

function unhighlight(e) {
  dropArea.classList.remove('highlight');
}

// Handle dropped files
dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
  let dt = e.dataTransfer;
  let files = dt.files;

  if (files.length) {
    handleFiles(files);
  }
}

function handleFiles(files) {
  ([...files]).forEach(uploadFile);
}

function uploadFile(file) {
  let reader = new FileReader();
  reader.onloadend = function() {
    try {
      const data = JSON.parse(reader.result);
      processUploadedData(data);
    } catch (error) {
      console.error('Error parsing JSON:', error);
      displayError('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
}
