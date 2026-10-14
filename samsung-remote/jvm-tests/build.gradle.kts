// Runs the TV protocol drivers (plain JVM code, no Android APIs) against fake TVs.
plugins { kotlin("jvm") version "1.9.24" }


sourceSets {
    main {
        kotlin.srcDir("../app/src/main/java/com/home/tvremote")
        // Only the protocol code: everything else uses Android APIs.
        kotlin.include("**/Proto.kt", "**/Certs.kt", "**/Net.kt", "**/Driver.kt", "**/*Driver.kt")
    }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.json:json:20240303")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("com.squareup.okhttp3:okhttp-tls:4.12.0")
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
}

tasks.test {
    testLogging {
        events("passed", "failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}
