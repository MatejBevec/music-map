import sys
import os
import math
import json

import numpy as np
import sklearn
from sklearn.manifold import TSNE
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis as LDA
import umap
import matplotlib.pyplot as plt
import matplotlib


def show_plot(points, classes, title):

    x = points[:, 0]
    y = points[:, 1]
    clss, labels = np.unique(classes, return_inverse=True)
    print(labels)
    print(clss)
    colors = ["chocolate", "gray", "saddlebrown", "yellow", "limegreen", "lightcoral", "orange", "black", "midnightblue", "red", "teal", "darkgreen", "steelblue", "deeppink"]

    plt.scatter(x, y, c=labels, cmap=matplotlib.colors.ListedColormap(colors))
    plt.colorbar()
    plt.title(title)
    plt.show()


def compute_tsne(emb):
    print("Computing t-SNE...")

    emb = np.array(emb)

    tsne = TSNE(n_components=2,
                perplexity=50.0,
                early_exaggeration=12.0,
                learning_rate="auto",
                n_iter=5000,
            )

    proj = tsne.fit_transform(emb)
    proj -= np.min(proj, axis=0)
    proj /= np.max(proj, axis=0)

    return proj

def compute_umap(emb):
    print("Computing UMAP...")
    
    reducer = umap.UMAP()

    proj = reducer.fit_transform(emb)
    proj -= np.min(proj, axis=0)
    proj /= np.max(proj, axis=0)

    return proj

def compute_lda(emb, classes):
    print("Computing LDA...")

    reducer = LDA(n_components=2)

    proj = reducer.fit_transform(emb, classes)
    proj -= np.min(proj, axis=0)
    proj /= np.max(proj, axis=0)

    return proj



if __name__ == "__main__":

    head = sys.argv[1]

    embpth = head + "/embeddings.json"
    savepth = head + "/projected.json"
    metapth = head + "/tracks.json"
    gpth = head + "/graph.json"

    with open(embpth, "r") as f:
        emb = json.load(f)
    
    with open(gpth, "r") as f:
        g = json.load(f)
        ids = g["tracks"]

    with open(metapth, "r", encoding="utf-8") as f:
        tracks = json.load(f)
        genres = [tracks[idd]["genre_class"] for idd in ids] # correct order?
    #print(genres)

    #proj_tsne = compute_tsne(emb)
    #proj_umap = compute_umap(emb)
    emb = np.array(emb)
    emb = np.random.rand(emb.shape[0], emb.shape[1])
    proj_lda = compute_lda(emb, genres)

    #show_plot(proj_tsne, genres, "t-SNE")
    #show_plot(proj_umap, genres, "UMAP")
    show_plot(proj_lda, genres, "LDA")

    print(savepth)

    with open(savepth, "w") as f:
        json.dump(proj_lda.tolist(), f, separators=(',', ':'))
