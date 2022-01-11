import callerCallsite from "caller-callsite";
import path from "path";
import { AppController } from "./helpers/app-controller";
import { AppDir } from "./test-runner";

export interface TestSuite {
  filePath: string;
  description: string;
  testCases: TestCase[];
}

export interface TestCase {
  description: string;
  testDir: string;
  run: (options: {
    appDir: AppDir;
    controller: AppController;
    outputDirPath: string;
  }) => Promise<void>;
}

export async function testSuite(
  description: string,
  testFactory: (test: TestCreator) => void | Promise<void>
): Promise<TestSuite> {
  const filePath = callerCallsite()?.getFileName();
  if (!filePath) {
    throw new Error(`Unable to detect caller file path`);
  }
  const testCases: TestCase[] = [];
  await testFactory((description, testAppName, run) => {
    const testDir = path.join(__dirname, "..", "..", "test-apps", testAppName);
    testCases.push({
      description,
      testDir,
      run,
    });
  });
  return {
    filePath,
    description,
    testCases,
  };
}

export type TestCreator = (
  description: string,
  testAppName: string,
  run: (options: {
    appDir: AppDir;
    controller: AppController;
    outputDirPath: string;
  }) => Promise<void>
) => void;
