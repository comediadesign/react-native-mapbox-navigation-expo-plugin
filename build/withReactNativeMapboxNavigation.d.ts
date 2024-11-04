import { ConfigPlugin, XcodeProject } from "@expo/config-plugins";
/**
 * Exclude building for arm64 on simulator devices in the pbxproj project.
 * Without this, production builds targeting simulators will fail.
 */
export declare function setExcludedArchitectures(project: XcodeProject): XcodeProject;
type InstallerBlockName = "pre" | "post";
export type MapboxNavigationPlugProps = {
    RNMBNAVDownloadToken?: string;
    MBXAccessToken?: string;
    NSLocationWhenInUseUsageDescription?: string;
};
export declare function applyCocoaPodsModifications(contents: string, { RNMBNAVDownloadToken }: MapboxNavigationPlugProps): string;
export declare function addConstantBlock(src: string, RNMBNAVDownloadToken?: string): string;
export declare function addDisableOutputPathsBlock(src: string): string;
export declare function addInstallerBlock(src: string, blockName: InstallerBlockName): string;
export declare function addMapboxInstallerBlock(src: string, blockName: InstallerBlockName): string;
declare const _default: ConfigPlugin<MapboxNavigationPlugProps>;
export default _default;
