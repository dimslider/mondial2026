plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val buildNumber = System.getenv("GITHUB_RUN_NUMBER")?.toIntOrNull() ?: 1

android {
    namespace = "com.home.tvremote"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.home.tvremote"
        minSdk = 26
        targetSdk = 36
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
    }

    signingConfigs {
        create("release") {
            // Family build: fixed key so each new build installs as an update over the previous one.
            storeFile = file("release.keystore")
            storePassword = "tvremote"
            keyAlias = "tvremote"
            keyPassword = "tvremote"
        }
        // Google Play build: the private upload key, given to CI as secrets (never in the repository).
        val uploadKey = System.getenv("UPLOAD_KEYSTORE_FILE")
        if (!uploadKey.isNullOrEmpty()) create("upload") {
            storeFile = file(uploadKey)
            storePassword = System.getenv("UPLOAD_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("UPLOAD_KEY_ALIAS") ?: "upload"
            keyPassword = System.getenv("UPLOAD_KEY_PASSWORD") ?: System.getenv("UPLOAD_KEYSTORE_PASSWORD")
        }
    }

    flavorDimensions += "store"
    productFlavors {
        // Installed from GitHub releases by family and friends: free, no purchase checks.
        create("family") {
            dimension = "store"
            applicationId = "com.home.tvremote"
            signingConfig = signingConfigs.getByName("release")
        }
        // Google Play: free trial, then a one-time purchase.
        create("play") {
            dimension = "store"
            applicationId = "com.dimslider.tvremote"
            signingConfig = signingConfigs.findByName("upload")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    "playImplementation"("com.android.billingclient:billing:8.0.0")
    "playImplementation"("com.google.android.play:review:2.0.2")
}
