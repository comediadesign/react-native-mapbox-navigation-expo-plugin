import { ConfigPlugin, XcodeProject } from "@expo/config-plugins";
/**
 * Exclude building for arm64 on simulator devices in the pbxproj project.
 * Without this, production builds targeting simulators will fail.
 */
export declare function setExcludedArchitectures(project: XcodeProject): XcodeProject;
type InstallerBlockName = "pre" | "post";
export type MapboxNavigationPlugProps = {
    RNMBNAVDownloadToken?: string;
    RNMBNAVPublicToken?: string;
    RNMapboxMapsVersion?: string;
};
export declare function applyCocoaPodsModifications(contents: string, { RNMBNAVDownloadToken, RNMBNAVPublicToken, RNMapboxMapsVersion, }: MapboxNavigationPlugProps): string;
export declare function addConstantBlock(src: string, RNMBNAVDownloadToken?: string, RNMBNAVPublicToken?: string, RNMapboxMapsVersion?: string): string;
export declare function addDisableOutputPathsBlock(src: string): string;
export declare function addInstallerBlock(src: string, blockName: InstallerBlockName): string;
export declare function addMapboxInstallerBlock(src: string, blockName: InstallerBlockName): string;
declare const _default: ConfigPlugin<MapboxNavigationPlugProps>;
export default _default;
