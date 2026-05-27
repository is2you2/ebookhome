class IndexedDB {
    svelteDB: IDBDatabase | null = null;

    initialize(_CallBack = () => { }) {
        if (this.svelteDB) {
            _CallBack();
            return;
        }

        const req = indexedDB.open('/svfs', 10);

        const removeSignals = () => {
            req.onsuccess = null;
            req.onupgradeneeded = null;
            req.onerror = null;
        };

        req.onsuccess = (e: any) => {
            const db = e.target.result;
            db.close();

            const second_req = indexedDB.open('/svfs', 11);

            second_req.onsuccess = (e: any) => {
                this.svelteDB = e.target.result;
                _CallBack();
                removeSignals();
            };
        };

        req.onupgradeneeded = (e: any) => {
            const database: IDBDatabase = e.target.result;
            database.createObjectStore('FILE_DATA');
        };

        req.onerror = () => {
            const req = indexedDB.open('/svfs', 11);

            req.onsuccess = (e: any) => {
                this.svelteDB = e.target.result;
                _CallBack();
                removeSignals();
            };
        };
    }

    /** recursive directory */
    private createRecursiveDirectory(path: string, targetDB = this.svelteDB!) {
        const lastIndexOf = path.lastIndexOf('/');
        const dir = path.substring(0, lastIndexOf);
        if (!dir) return;

        this.checkIfFileExist(dir).then((b) => {
            if (b) {
                this.createRecursiveDirectory(dir, targetDB);
                return;
            }

            const put = targetDB
                .transaction('FILE_DATA', 'readwrite')
                .objectStore('FILE_DATA')
                .put(
                    {
                        timestamp: new Date(),
                        mode: 16893,
                    },
                    `/userfs/${dir}`
                );

            const removeSignals = () => {
                put.onsuccess = null;
                put.onerror = null;
            };

            put.onsuccess = (ev: any) => {
                this.createRecursiveDirectory(dir, targetDB);
                removeSignals();
            };

            put.onerror = (e) => {
                console.error('IndexedDB createRecursiveDirectory failed: ', e);
                removeSignals();
            };
        });
    }

    createDirectory(path: string) {
        return new Promise((resolve, reject) => {
            this.checkIfFileExist(path).then((b) => {
                if (b) return reject('AlreadyExistFolder');

                const put = this.svelteDB!
                    .transaction('FILE_DATA', 'readwrite')
                    .objectStore('FILE_DATA')
                    .put(
                        {
                            timestamp: new Date(),
                            mode: 16893,
                        },
                        `/userfs/${path}`
                    );

                put.onsuccess = () => {
                    resolve(undefined);
                };

                put.onerror = (e) => {
                    reject(e);
                };
            });
        });
    }

    async saveBlobToUserPath(blob: Blob, path: string, targetDB = this.svelteDB!) {
        return await new Promise(async (done, error) => {
            let clonedData: any;

            try {
                const arrayBuffer = await blob.arrayBuffer();

                if (targetDB === this.svelteDB) {
                    clonedData = new Blob([arrayBuffer], { type: blob.type });
                } else {
                    clonedData = new Int8Array(arrayBuffer);
                }
            } catch (e) {
                return error(e);
            }

            this.createRecursiveDirectory(path, targetDB);

            const put = targetDB
                .transaction('FILE_DATA', 'readwrite')
                .objectStore('FILE_DATA')
                .put(
                    {
                        timestamp: new Date(),
                        mode: 33206,
                        contents: clonedData,
                    },
                    `/userfs/${path}`
                );

            put.onsuccess = () => done(undefined);
            put.onerror = (e) => error(e);
        });
    }

    checkIfFileExist(path: string, targetDB = this.svelteDB!) {
        return new Promise<boolean>((done, error) => {
            const data = targetDB
                .transaction('FILE_DATA', 'readonly')
                .objectStore('FILE_DATA')
                .count(`/userfs/${path}`);

            data.onsuccess = (ev: any) => {
                done(ev.target.result);
            };

            data.onerror = (e) => error(e);
        });
    }

    GetFileListFromDB(path: string, targetDB = this.svelteDB!) {
        return new Promise<string[]>((done, error) => {
            const data = targetDB
                .transaction('FILE_DATA', 'readonly')
                .objectStore('FILE_DATA')
                .getAllKeys();

            data.onsuccess = (ev: any) => {
                const keys: string[] = ev.target.result;

                for (let i = keys.length - 1; i >= 0; i--) {
                    if (!keys[i].includes(path)) keys.splice(i, 1);
                    else keys[i] = keys[i].substring(8);
                }

                done(keys);
            };

            data.onerror = (e) => error(e);
        });
    }

    GetFileInfoFromDB(path: string, targetDB = this.svelteDB!) {
        return new Promise((done, error) => {
            const data = targetDB
                .transaction('FILE_DATA', 'readonly')
                .objectStore('FILE_DATA')
                .get(`/userfs/${path}`);

            data.onsuccess = (ev: any) => {
                done(ev.target.result);
            };

            data.onerror = (e) => error(e);
        });
    }

    loadBlobFromUserPath(path: string, mime: string, targetDB = this.svelteDB!) {
        return new Promise<Blob>((done, error) => {
            const data = targetDB
                .transaction('FILE_DATA', 'readonly')
                .objectStore('FILE_DATA')
                .get(`/userfs/${path}`);

            data.onsuccess = (ev: any) => {
                try {
                    let blob = ev.target.result.contents;

                    if (!(blob instanceof Blob)) {
                        blob = new Blob([blob], { type: mime });
                    }

                    done(blob);
                } catch (e) {
                    error(e);
                }
            };

            data.onerror = (e) => error(e);
        });
    }

    DownloadFileFromUserPath(path: string, mime: string, filename: string, targetDB = this.svelteDB!) {
        const data = targetDB
            .transaction('FILE_DATA', 'readonly')
            .objectStore('FILE_DATA')
            .get(`/userfs/${path}`);

        data.onsuccess = (ev: any) => {
            const blob = new Blob([ev.target.result.contents], {
                type: mime || 'application/octet-stream',
            });

            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.download = filename;
            link.href = url;

            document.body.appendChild(link);
            link.click();

            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };
    }

    removeFileFromUserPath(path: string, targetDB = this.svelteDB!) {
        return new Promise((done, error) => {
            const data = targetDB
                .transaction('FILE_DATA', 'readwrite')
                .objectStore('FILE_DATA')
                .delete(`/userfs/${path}`);

            data.onsuccess = (ev) => done(ev);
            data.onerror = (e) => error(e);
        });
    }
}

export const indexed = new IndexedDB();