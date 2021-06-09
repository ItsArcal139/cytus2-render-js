interface DataVersion {
    version: number;
    upgrade(data: any): void
    downgrade(data: any): void
}

export class DataUpgrader {
    public versions: DataVersion[];

    public constructor() {
        this.versions = [];
    }

    public addVersion(num: number, upgrade: (data: any) => {}, downgrade: (data: any) => {}) {
        this.versions.push({
            version: num,
            upgrade, downgrade
        });
    }

    public getNewestVersion(): DataVersion | null {
        var n = 0;
        var v: DataVersion | null = null;
        this.versions.forEach(ver => {
            var o = n;
            n = Math.max(n, ver.version);
            if(o != n) v = ver;
        });
        return v;
    }

    public getNextVersion(n: DataVersion): DataVersion | null {
        var v: DataVersion | null = null;
        this.versions.forEach(ver => {
            if(ver.version > n.version && v == null) {
                v = ver;
            }
        });
        return v;
    }

    public upgrade(data: any, sourceVersion: DataVersion, targetVersion: DataVersion) {
        targetVersion = targetVersion || this.getNewestVersion();
        var newVersion = this.getNextVersion(sourceVersion);
        do {
            // @ts-ignore
            this.performUpgrade(data, newVersion);
            // @ts-ignore
            newVersion = this.getNextVersion(newVersion);
        } while(newVersion?.version ?? 0 < targetVersion.version)
    }

    public performUpgrade(data: any, version: DataVersion) {
        version.upgrade(data);
    }

    public performDowngrade(data: any, version: DataVersion) {
        version.downgrade(data);
    }
}