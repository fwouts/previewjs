package com.previewjs.intellij.plugin.api

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

fun api(baseUrl: String): PreviewJsApi {
    val moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()
    val okHttpClient: OkHttpClient = OkHttpClient().newBuilder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .writeTimeout(10, TimeUnit.SECONDS)
        .build()
    val retrofit = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(okHttpClient)
        .addConverterFactory(MoshiConverterFactory.create(moshi))
        .build()

    return retrofit.create(PreviewJsApi::class.java)
}

interface PreviewJsApi {
    @POST("/crawl-file")
    suspend fun crawlFile(@Body req: CrawlFileRequest): CrawlFileResponse

    @POST("/previews/start")
    suspend fun startPreview(@Body req: StartPreviewRequest): StartPreviewResponse

    @POST("/previews/status")
    suspend fun checkPreviewStatus(@Body req: CheckPreviewStatusRequest): CheckPreviewStatusResponse

    @POST("/previews/stop")
    suspend fun stopPreview(@Body req: StopPreviewRequest): StopPreviewResponse

    @POST("/pending-files/update")
    suspend fun updatePendingFile(@Body req: UpdatePendingFileRequest): UpdatePendingFileResponse
}

data class CrawlFileRequest(
    val absoluteFilePath: String
)

data class CrawlFileResponse(
    val rootDir: String?,
    val previewables: List<Previewable>
)

data class Previewable(
    val start: Int,
    val end: Int,
    val id: String
)

data class StartPreviewRequest(
    val rootDir: String
)

data class StartPreviewResponse(
    val url: String
)

data class CheckPreviewStatusRequest(
    val rootDir: String
)

data class CheckPreviewStatusResponse(
    val running: Boolean
)

data class StopPreviewRequest(
    val rootDir: String
)

class StopPreviewResponse

data class UpdatePendingFileRequest(
    val absoluteFilePath: String,
    val utf8Content: String?
)

class UpdatePendingFileResponse
