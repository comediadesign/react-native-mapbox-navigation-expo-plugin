import { promises } from "fs";
import path from "path";
import {
  createRunOncePlugin,
  ConfigPlugin,
  withDangerousMod,
  withXcodeProject,
  XcodeProject,
} from "@expo/config-plugins";
import {
  mergeContents,
  removeGeneratedContents,
} from "@expo/config-plugins/build/utils/generateCode";

/**
 * Exclude building for arm64 on simulator devices in the pbxproj project.
 * Without this, production builds targeting simulators will fail.
 */
export function setExcludedArchitectures(project: XcodeProject): XcodeProject {
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

const withExcludedSimulatorArchitectures: ConfigPlugin = (c) => {
  return withXcodeProject(c, (config) => {
    config.modResults = setExcludedArchitectures(config.modResults);
    return config;
  });
};

type InstallerBlockName = "pre" | "post";

export type MapboxNavigationPlugProps = {
  RNMBNAVVersion?: string;
  RNMBNAVDownloadToken?: string;
  RNMBNAVPublicToken?: string;
  RNMapboxMapsVersion?: string;
};

/**
 * Dangerously adds the custom installer hooks to the Podfile.
 * In the future this should be removed in favor of some custom hooks provided by Expo autolinking.
 *
 * @param config
 * @returns
 */
const withCocoaPodsInstallerBlocks: ConfigPlugin<MapboxNavigationPlugProps> = (
  c,
  {
    RNMBNAVVersion,
    RNMBNAVDownloadToken,
    RNMBNAVPublicToken,
    RNMapboxMapsVersion,
  }
) => {
  return withDangerousMod(c, [
    "ios",
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, "Podfile");

      const contents = await promises.readFile(file, "utf8");

      await promises.writeFile(
        file,
        applyCocoaPodsModifications(contents, {
          RNMBNAVVersion,
          RNMBNAVDownloadToken,
          RNMBNAVPublicToken,
          RNMapboxMapsVersion,
        }),
        "utf-8"
      );
      return config;
    },
  ]);
};

// Only the preinstaller block is required, the post installer block is
// used for spm (swift package manager) which Expo doesn't currently support.
export function applyCocoaPodsModifications(
  contents: string,
  {
    RNMBNAVVersion,
    RNMBNAVDownloadToken,
    RNMBNAVPublicToken,
    RNMapboxMapsVersion,
  }: MapboxNavigationPlugProps
): string {
  // Ensure installer blocks exist
  let src = addConstantBlock(
    contents,
    RNMBNAVVersion,
    RNMBNAVDownloadToken,
    RNMBNAVPublicToken,
    RNMapboxMapsVersion
  );
  src = addDisableOutputPathsBlock(src);
  src = addInstallerBlock(src, "pre");
  src = addInstallerBlock(src, "post");
  src = addMapboxInstallerBlock(src, "pre");
  src = addMapboxInstallerBlock(src, "post");
  return src;
}

export function addConstantBlock(
  src: string,
  RNMBNAVVersion?: string,
  RNMBNAVDownloadToken?: string,
  RNMBNAVPublicToken?: string,
  RNMapboxMapsVersion?: string
): string {
  const tag = `@comediadesign/react-native-mapbox-navigation-rbmbnaversion`;

  return mergeContents({
    tag,
    src,
    newSrc: [
      RNMBNAVVersion && RNMBNAVVersion.length > 0
        ? `$RNMBNAVVersion = '${RNMBNAVVersion}'`
        : "",
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

export function addDisableOutputPathsBlock(src: string): string {
  const tag = `@comediadesign/react-native-mapbox-navigation-rbmbnatop`;

  return mergeContents({
    tag,
    src,
    newSrc: ":disable_input_output_paths => true, \n",
    anchor: /:deterministic_uuids => false/,
    // We can't go after the use_react_native block because it might have parameters, causing it to be multi-line (see react-native template).
    offset: 0,
    comment: "#",
  }).contents;
}

export function addInstallerBlock(
  src: string,
  blockName: InstallerBlockName
): string {
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
        const modified = removeGeneratedContents(src, tag);
        if (!modified) {
          return src;
        }
      }
    }
  }

  return mergeContents({
    tag,
    src,
    newSrc: [`  ${blockName}_install do |installer|`, "  end"].join("\n"),
    anchor: /use_react_native/,
    // We can't go after the use_react_native block because it might have parameters, causing it to be multi-line (see react-native template).
    offset: 0,
    comment: "#",
  }).contents;
}

export function addMapboxInstallerBlock(
  src: string,
  blockName: InstallerBlockName
): string {
  return mergeContents({
    tag: `@comediadesign/react-native-mapbox-navigation-${blockName}_installer`,
    src,
    newSrc: `    $RNMBNAV.${blockName}_install(installer)`,
    anchor: new RegExp(`^\\s*${blockName}_install do \\|installer\\|`),
    offset: 1,
    comment: "#",
  }).contents;
}

/**
 * Apply react-native-mapbox-navigation configuration for Expo SDK 47 projects.
 */
const withReactNativeMapboxNavigation: ConfigPlugin<
  MapboxNavigationPlugProps
> = (config, { RNMBNAVVersion, RNMBNAVDownloadToken, RNMBNAVPublicToken }) => {
  config = withExcludedSimulatorArchitectures(config);
  return withCocoaPodsInstallerBlocks(config, {
    RNMBNAVVersion,
    RNMBNAVDownloadToken,
    RNMBNAVPublicToken,
  });
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

export default createRunOncePlugin(
  withReactNativeMapboxNavigation,
  pkg.name,
  pkg.version
);
