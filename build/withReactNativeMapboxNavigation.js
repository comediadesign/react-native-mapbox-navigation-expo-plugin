"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addMapboxInstallerBlock = exports.addInstallerBlock = exports.addDisableOutputPathsBlock = exports.addConstantBlock = exports.applyCocoaPodsModifications = exports.setExcludedArchitectures = void 0;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const config_plugins_1 = require("@expo/config-plugins");
const generateCode_1 = require("@expo/config-plugins/build/utils/generateCode");
/**
 * Exclude building for arm64 on simulator devices in the pbxproj project.
 * Without this, production builds targeting simulators will fail.
 */
function setExcludedArchitectures(project) {
    const configurations = project.pbxXCBuildConfigurationSection();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    for (const { buildSettings } of Object.values(configurations || {})) {
        // Guessing that this is the best way to emulate Xcode.
        // Using `project.addToBuildSettings` modifies too many targets.
        if (typeof buildSettings?.PRODUCT_NAME !== "undefined") {
            buildSettings['"EXCLUDED_ARCHS[sdk=iphonesimulator*]"'] = '"arm64"';
        }
    }
    return project;
}
exports.setExcludedArchitectures = setExcludedArchitectures;
const withExcludedSimulatorArchitectures = (c) => {
    return (0, config_plugins_1.withXcodeProject)(c, (config) => {
        config.modResults = setExcludedArchitectures(config.modResults);
        return config;
    });
};
/**
 * Dangerously adds the custom installer hooks to the Podfile.
 * In the future this should be removed in favor of some custom hooks provided by Expo autolinking.
 *
 * @param config
 * @returns
 */
const withCocoaPodsInstallerBlocks = (c, { RNMBNAVDownloadToken, RNMBNAVPublicToken, RNMapboxMapsVersion }) => {
    return (0, config_plugins_1.withDangerousMod)(c, [
        "ios",
        async (config) => {
            const file = path_1.default.join(config.modRequest.platformProjectRoot, "Podfile");
            const contents = await fs_1.promises.readFile(file, "utf8");
            await fs_1.promises.writeFile(file, applyCocoaPodsModifications(contents, {
                RNMBNAVDownloadToken,
                RNMBNAVPublicToken,
                RNMapboxMapsVersion,
            }), "utf-8");
            return config;
        },
    ]);
};
// Only the preinstaller block is required, the post installer block is
// used for spm (swift package manager) which Expo doesn't currently support.
function applyCocoaPodsModifications(contents, { RNMBNAVDownloadToken, RNMBNAVPublicToken, RNMapboxMapsVersion, }) {
    // Ensure installer blocks exist
    let src = addConstantBlock(contents, RNMBNAVDownloadToken, RNMBNAVPublicToken, RNMapboxMapsVersion);
    src = addDisableOutputPathsBlock(src);
    src = addInstallerBlock(src, "pre");
    src = addInstallerBlock(src, "post");
    src = addMapboxInstallerBlock(src, "pre");
    src = addMapboxInstallerBlock(src, "post");
    return src;
}
exports.applyCocoaPodsModifications = applyCocoaPodsModifications;
function addConstantBlock(src, RNMBNAVDownloadToken, RNMBNAVPublicToken, RNMapboxMapsVersion) {
    const tag = `@comediadesign/react-native-mapbox-navigation-rbmbnaversion`;
    return (0, generateCode_1.mergeContents)({
        tag,
        src,
        newSrc: [
            RNMBNAVDownloadToken && RNMBNAVDownloadToken.length > 0
                ? `$RNMBNAVDownloadToken = '${RNMBNAVDownloadToken}'`
                : "",
            RNMBNAVPublicToken && RNMBNAVPublicToken.length > 0
                ? `$RNMBNAVPublicToken = '${RNMBNAVPublicToken}'`
                : "",
            RNMapboxMapsVersion && RNMapboxMapsVersion.length > 0
                ? `$RNMapboxMapsVersion = '${RNMapboxMapsVersion}'`
                : "",
        ].join("\n"),
        anchor: /target .+ do/,
        // We can't go after the use_react_native block because it might have parameters, causing it to be multi-line (see react-native template).
        offset: 0,
        comment: "#",
    }).contents;
}
exports.addConstantBlock = addConstantBlock;
function addDisableOutputPathsBlock(src) {
    const tag = `@comediadesign/react-native-mapbox-navigation-rbmbnatop`;
    return (0, generateCode_1.mergeContents)({
        tag,
        src,
        newSrc: ":disable_input_output_paths => true, \n",
        anchor: /:deterministic_uuids => false/,
        // We can't go after the use_react_native block because it might have parameters, causing it to be multi-line (see react-native template).
        offset: 0,
        comment: "#",
    }).contents;
}
exports.addDisableOutputPathsBlock = addDisableOutputPathsBlock;
function addInstallerBlock(src, blockName) {
    const matchBlock = new RegExp(`${blockName}_install do \\|installer\\|`);
    const tag = `${blockName}_installer`;
    for (const line of src.split("\n")) {
        const contents = line.trim();
        // Ignore comments
        if (!contents.startsWith("#")) {
            // Prevent adding the block if it exists outside of comments.
            if (contents.match(matchBlock)) {
                // This helps to still allow revisions, since we enabled the block previously.
                // Only continue if the generated block exists...
                const modified = (0, generateCode_1.removeGeneratedContents)(src, tag);
                if (!modified) {
                    return src;
                }
            }
        }
    }
    return (0, generateCode_1.mergeContents)({
        tag,
        src,
        newSrc: [`  ${blockName}_install do |installer|`, "  end"].join("\n"),
        anchor: /use_react_native/,
        // We can't go after the use_react_native block because it might have parameters, causing it to be multi-line (see react-native template).
        offset: 0,
        comment: "#",
    }).contents;
}
exports.addInstallerBlock = addInstallerBlock;
function addMapboxInstallerBlock(src, blockName) {
    return (0, generateCode_1.mergeContents)({
        tag: `@comediadesign/react-native-mapbox-navigation-${blockName}_installer`,
        src,
        newSrc: `    $RNMBNAV.${blockName}_install(installer)`,
        anchor: new RegExp(`^\\s*${blockName}_install do \\|installer\\|`),
        offset: 1,
        comment: "#",
    }).contents;
}
exports.addMapboxInstallerBlock = addMapboxInstallerBlock;
/**
 * Apply react-native-mapbox-navigation configuration for Expo SDK 47 projects.
 */
const withReactNativeMapboxNavigation = (config, { RNMBNAVDownloadToken, RNMBNAVPublicToken }) => {
    return withExcludedSimulatorArchitectures(withCocoaPodsInstallerBlocks(config, {
        RNMBNAVDownloadToken,
        RNMBNAVPublicToken,
    }));
};
const pkg = {
    // Prevent this plugin from being run more than once.
    // This pattern enables users to safely migrate off of this
    // out-of-tree `@config-plugins/react-native-mapbox-navigation` to a future
    // upstream plugin in `react-native-mapbox-navigation`
    name: "react-native-mapbox-navigation",
    // Indicates that this plugin is dangerously linked to a module,
    // and might not work with the latest version of that module.
    version: "UNVERSIONED",
};
exports.default = (0, config_plugins_1.createRunOncePlugin)(withReactNativeMapboxNavigation, pkg.name, pkg.version);
