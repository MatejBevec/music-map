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
import torch
import mplcursors

from metadata import GENRES, COLORS, COLORMAP


def load_embedding(pth):
    
    emb = []

    if os.path.isfile(pth) and pth.rsplit(".")[-1] == "json":
        with open(pth, "r") as f:
            emb = np.array(json.load(f))

    elif os.path.isdir(pth):
        fns = sorted(list(os.listdir(pth)))
        if fns[0].rsplit(".")[-1] == "pt":
            load_func = lambda x: torch.load(x).numpy()
        else:
            load_func= np.load

        for fn in fns:
            emb.append(load_func(os.path.join(pth, fn)))
        
        emb = np.array(emb)

        print(type(emb), emb.shape)
        print(emb[:1, :5])
        print(fns[:5])

    return emb

def save_embedding(emb, pth):
    if isinstance(emb, np.ndarray): emb = emb.tolist()
    with open(pth, "w") as f:
        json.dump(emb, f, separators=(',', ':'))


def load_metadata(pth):

    metapth = pth + "/tracks.json"
    gpth = pth + "/graph.json"

    with open(gpth, "r") as f:
        g = json.load(f)
        ids = sorted(list(g["tracks"]))

    with open(metapth, "r", encoding="utf-8") as f:
        tracks = json.load(f)
        genres = [tracks[idd]["genre_class"] for idd in ids]
        titles = [tracks[idd]["name"] for idd in ids]
        artists = [tracks[idd]["artist"] for idd in ids]
        subgenres = [tracks[idd]["artist_genres"] for idd in ids]

    return ids, titles, artists, genres, subgenres

        
        

def show_plot(points, classes, title, metadata=None):

    x = points[:, 0]
    y = points[:, 1]
    clss, labels = np.unique(classes, return_inverse=True)
    print(labels)
    print(clss)
    colors = ["chocolate", "gray", "saddlebrown", "yellow", "limegreen", "lightcoral", "orange", "black", "midnightblue", "red", "teal", "darkgreen", "steelblue", "deeppink"]
    #colors = COLORS
    scatter = plt.scatter(x, y, c=labels, cmap=matplotlib.colors.ListedColormap(colors))

    hover_info = metadata if metadata is not None else classes

    def on_hover(sel):
        ind = sel.target.index
        sel.annotation.set(text=hover_info[ind])
        #x, y = sel.target
        #sel.annotation.set(text=f'Point {ind}: ({x:.2f}, {y:.2f})')
    cursor = mplcursors.cursor(scatter, hover=True)
    cursor.connect('add', on_hover)

    plt.legend(labels=classes, title="Genre")
    plt.colorbar()
    plt.title(title)
    plt.show()


def compute_tsne(emb):
    print("Computing t-SNE...")

    if os.path.isfile("tsne.json"):
        print("Found precomputed")
        return load_embedding("tsne.json")

    emb = np.array(emb)

    tsne = TSNE(n_components=2,
                perplexity=50.0,
                early_exaggeration=12.0,
                learning_rate="auto",
                n_iter=5000,
                init="pca"
            )

    proj = tsne.fit_transform(emb)
    proj -= np.min(proj, axis=0)
    proj /= np.max(proj, axis=0)

    save_embedding(proj, "tsne.json")
    return proj

def compute_umap(emb):
    print("Computing UMAP...")

    if os.path.isfile("umap.json"):
        return load_embedding("umap.json")
    
    reducer = umap.UMAP()

    proj = reducer.fit_transform(emb)
    proj -= np.min(proj, axis=0)
    proj /= np.max(proj, axis=0)

    save_embedding(proj, "umap.json")
    return proj

def compute_lda(emb, classes):
    print("Computing LDA...")

    if os.path.isfile("lda.json"):
        return load_embedding("lda.json")

    reducer = LDA(n_components=2)

    proj = reducer.fit_transform(emb, classes)
    proj -= np.min(proj, axis=0)
    proj /= np.max(proj, axis=0)

    save_embedding(proj, "lda.json")
    return proj



if __name__ == "__main__":

    head = sys.argv[1]

    embpth = head + "/features/node2vec"
    savepth = head + "/projected.json"
    metapth = head + "/tracks.json"
    gpth = head + "/graph.json"

    print("Loading embeddings ...")
    emb = load_embedding(embpth)
    print(len(emb))
    
    print("Loading ids ...")
    with open(gpth, "r") as f:
        g = json.load(f)
        ids = sorted(list(g["tracks"]))

    print(ids[:5])

    with open(metapth, "r", encoding="utf-8") as f:
        tracks = json.load(f)
        genres = [tracks[idd]["genre_class"] for idd in ids]
        titles = [tracks[idd]["name"] for idd in ids]
        artists = [tracks[idd]["artist"] for idd in ids]
        metadata = [f"{t} - {a} ({g})" for t, a, g in zip(titles, artists, genres)]
    #print(genres)

    clss, labels = np.unique(genres, return_inverse=True)
    print(clss)

    proj_tsne = compute_tsne(emb)
    proj_umap = compute_umap(emb)
    print(len(pro))
    #proj_lda = compute_lda(emb, genres)

    show_plot(proj_tsne, genres, "t-SNE", metadata=metadata)
    show_plot(proj_umap, genres, "UMAP", metadata=metadata)
    #show_plot(proj_lda, genres, "LDA", metadata=metadata)

    print(savepth)

    # if  not( len(sys.argv) > 2 and sys.argv[2] == "nosave"):
    #     with open(savepth, "w") as f:
    #         json.dump(proj_tsne.tolist(), f, separators=(',', ':'))

    # with open(savepth, "w") as f:
    #     json.dump(proj_tsne.tolist(), f, separators=(',', ':'))

    save_embedding(proj_tsne, "projected.json")
