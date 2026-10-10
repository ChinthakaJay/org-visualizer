# A local Node server reads, writes and watches the Org file

The app runs on your own machine, and a small Node server started with the path of one Org file does the reading, saving and watching. We chose this over the browser-only File System Access API so that edits made outside the app (VS Code, `git pull`) show up live, and so it works in any browser. The server binds to 127.0.0.1 only and can touch only the file it was started with.
