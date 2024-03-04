from flask import Flask, render_template, request, jsonify
import numpy as np
from openai import OpenAI
from dotenv import load_dotenv
import os
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# OpenAI client initialization
client = OpenAI(api_key=OPENAI_API_KEY)

# Initialize Flask app
app = Flask(__name__)

# Caching embeddings to reduce API calls
embeddings_cache = {}

def get_word_embedding(word):
    """
    Retrieve or compute the embedding for a word.
    
    Args:
        word (str): The word to get the embedding for.

    Returns:
        np.array: The embedding of the word or None if an error occurs.
    """
    if word in embeddings_cache:
        return embeddings_cache[word]

    try:
        response = client.embeddings.create(
            input=word,
            model="text-embedding-3-small"
        )
        embedding = np.array(response.data[0].embedding)
        embeddings_cache[word] = embedding
        return embedding
    except Exception as e:
        # Logging the error is more suitable for production
        print(f"An error occurred: {e}")
        return None

def calculate_similarity(embedding1, embedding2):
    """ Calculate the cosine similarity between two embeddings. """
    if embedding1 is None or embedding2 is None:
        return None

    cosine_similarity = np.dot(embedding1, embedding2) / (np.linalg.norm(embedding1) * np.linalg.norm(embedding2))
    return cosine_similarity



@app.route('/')
def index():
    return render_template('index.html')


def perform_clustering(embeddings):
    """ Perform K-Means clustering on the given embeddings. """
    # Use 3 clusters by default
    kmeans = KMeans(n_clusters=3, random_state=0)
    return kmeans.fit_predict(embeddings)

def prepare_embeddings_for_visualization(words):
    """ Prepare embeddings for visualization. """
    embeddings = [get_word_embedding(word) for word in words]
    embeddings = [emb for emb in embeddings if emb is not None]

    if len(embeddings) < 3:
        # Not enough embeddings to form clusters
        return [{'word': word, 'coordinates': [0, 0, 0], 'cluster': 0} for word in words]

    # Perform clustering before dimensionality reduction
    cluster_labels = perform_clustering(np.array(embeddings))

    # Reduce dimensions using PCA
    pca = PCA(n_components=3)
    embeddings_3d = pca.fit_transform(np.array(embeddings))

    return [
        {'word': word, 'coordinates': coord.tolist(), 'cluster': int(cluster)}
        for word, coord, cluster in zip(words, embeddings_3d, cluster_labels)
    ]

def get_embeddings_and_similarities(words, central_word):
    """
    Get embeddings for the words and calculate similarities with the central word.

    Args:
        words (list): List of words to get embeddings for.
        central_word (str): The central word to compare with.

    Returns:
        list: List of dictionaries with words, their coordinates, cluster, and similarity.
    """
    central_embedding = get_word_embedding(central_word)
    embeddings = [get_word_embedding(word) for word in words]
    embeddings = [emb for emb in embeddings if emb is not None]

    if len(embeddings) < 3:
        return []

    cluster_labels = perform_clustering(np.array(embeddings))
    pca = PCA(n_components=3)
    embeddings_3d = pca.fit_transform(np.array(embeddings))

    # Calculate similarities with the central word
    similarities = [calculate_similarity(central_embedding, emb) for emb in embeddings]

    return [
        {'word': word, 'coordinates': coord.tolist(), 'cluster': int(cluster), 'similarity': similarity}
        for word, coord, cluster, similarity in zip(words, embeddings_3d, cluster_labels, similarities)
    ]

@app.route('/get_embeddings', methods=['POST'])
def get_embeddings():
    data = request.json
    words = data.get('words', [])
    central_word = data.get('centralWord', '')

    if not central_word or len(words) < 3:
        return jsonify({"error": "A central word and at least 3 other words are required"}), 400

    visualization_data = get_embeddings_and_similarities(words, central_word)
    print(visualization_data)
    return jsonify(visualization_data)

if __name__ == '__main__':
    app.run(debug=True)