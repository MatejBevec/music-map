import sys
import os
import math
import json

import numpy as np
import sklearn
import umap
import matplotlib.pyplot as plt
import matplotlib

from project import load_embedding, load_metadata, save_embedding
from metadata import GENRES, COLORS, COLORMAP


def compute_landmarks(raw_subgenres, base_genres, projection, cellsize=0.1):

    # Filter out top level genres
    #genres = ["classical","country","blues","folk","rock","punk","metal",
    #        "jazz","soul","pop","electronic","hiphop","reggae","latin"]
    genres = GENRES
    subgenres = []
    for i in range(len(raw_subgenres)):
        tags = raw_subgenres[i]
        for g in genres:
            if g in tags:
                tags.remove(g)
        subgenres.append(tags)


    n = int(1 / cellsize)
    votes = [[{} for j in range(n)] for i in range(n)]
    base_votes = [[{} for j in range(n)] for i in range(n)]
    #toptags = np.ndarray((n, n), dtype=str)
    toptags = [["" for j in range(n)] for i in range(n)]
    base_toptags = [["" for j in range(n)] for i in range(n)]

    for i in range(len(subgenres)):
        pos = projection[i]
        row = int((pos[0] - 1e-12) / cellsize)
        col = int((pos[1] - 1e-12) / cellsize)

        #print(row, col)

        g = base_genres[i]
        base_bin = base_votes[row][col]
        base_votes[row][col][g] = base_bin[g] + 1 if g in base_bin else 1

        for sg in subgenres[i]:
            bin = votes[row][col]
            votes[row][col][sg] = bin[sg] + 1 if sg in bin else 1

    for i in range(n):
        for j in range(n):
            counts = list(votes[i][j].values())
            if len(counts) == 0:
                continue
            maxind = np.argmax(counts)
            #print(np.max(counts))
            tags = list(votes[i][j].keys())
            toptags[i][j] = tags[maxind]
            
            base_counts = list(base_votes[i][j].values())
            base_maxind = np.argmax(base_counts)
            base_tags = list(base_votes[i][j].keys())
            base_toptags[i][j] = base_tags[base_maxind]     
            

    landmarks = np.array(toptags)
    base_landmarks = np.array(base_toptags)

    return landmarks, base_landmarks


def visualize_landmarks(landmarks, base, colormap):

    n = len(landmarks)
    grid_size = (n, n)
    grid = np.random.rand(*grid_size, 3)
    for i in range(n):
        for j in range(n):
            genre = base[i, j]
            if genre == "":
                color = matplotlib.colors.to_rgb("white")
            else:
                color = matplotlib.colors.to_rgb(colormap[base[i, j]])
            grid[i, j, 0] = color[0]
            grid[i, j, 1] = color[1]
            grid[i, j, 2] = color[2]

    fig, ax = plt.subplots(figsize=(8, 8))
    ax.imshow(grid)

    for i in range(grid_size[0]):
        for j in range(grid_size[1]):
            title = landmarks[i, j]
            title = title.replace(" ", "\n")
            ax.text(j, i, title, ha='center', va='center', color='w', fontsize=7)

    plt.axis('off')
    plt.show()



if __name__ == "__main__":

    head = sys.argv[1]
    srcpth = head + "/projected.json"
    with open(srcpth, "r") as f:
        pts = json.load(f)

    # colors = sorted(["chocolate", "gray", "saddlebrown", "yellow", "limegreen", "lightcoral", "orange", "black", "midnightblue", "red", "teal", "darkgreen", "steelblue", "deeppink", "white"])
    # classes = sorted(["classical","country","blues","folk","rock","punk","metal", "jazz","soul","pop","electronic","hiphop","reggae","latin", "other"])
    # print(classes)
    # colormap = {g: c for g, c in zip(classes, colors)}
    # print(colormap)

    colormap = COLORMAP
    
    ids, titles, artists, genres, subgenres = load_metadata(head)



    landmarks, base = compute_landmarks(subgenres, genres, pts, cellsize=0.02)

    print(colormap)
    visualize_landmarks(landmarks, base, colormap)

    landmark_pyramid = []


    sizes = [0.05, 0.025, 0.0125]
    for size in sizes:
        landmarks, base = compute_landmarks(subgenres, genres, pts, cellsize=size)
        landmark_pyramid.append( [landmarks.tolist(), base.tolist()] )
    
    save_embedding([sizes, landmark_pyramid], head + "/landmarks.json")